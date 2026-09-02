import type {
  Candidate,
  CandidateProfile,
  RunSummary,
} from "../core/models.js";
import type { PipelineDependencies } from "../core/contracts.js";
import { analyseCandidate } from "../analysis/analysis.js";
import { recommend } from "../analysis/recommendation.js";
import { scoreAnalysis } from "../analysis/scoring.js";
import type { MemoInput } from "../reports/memo.js";
import { collectEvidence } from "../research/evidence.js";
import type { HttpClient } from "../sources/types.js";
import { discoverCandidates } from "./discover.js";
import { createDefaultDependencies } from "./defaults.js";

type PipelineLogger = Pick<Console, "info" | "error">;

export async function runPipeline(input: {
  topic: string;
  rootDir: string;
  candidates?: Candidate[];
  http?: HttpClient;
  limit?: number;
  llmApiKey?: string;
  llmModel?: string;
  logger?: PipelineLogger;
  dependencies?: PipelineDependencies;
}): Promise<RunSummary> {
  const logger = input.logger ?? console;
  const dependencies = input.dependencies ?? createDefaultDependencies(input);
  logger.info(`[DealScout] Starting run for "${input.topic}".`);
  const run = await dependencies.store.createRun(input.rootDir, input.topic);
  if (!input.candidates)
    logger.info("[DealScout] Discovering candidates from YC and Hacker News.");
  const candidates =
    input.candidates ??
    (await discoverCandidates(input.topic, dependencies.sources, input.limit));
  logger.info(
    `[DealScout] Found ${candidates.length} candidates. Saving source records.`
  );
  await dependencies.store.writeJson(run, "candidates.json", candidates);
  const failures: string[] = [];
  const reportEntries: MemoInput[] = [];
  let completed = 0;
  for (const [index, candidate] of candidates.entries()) {
    const progress = `[DealScout] [${index + 1}/${candidates.length}] ${
      candidate.name
    }`;
    try {
      let profile: CandidateProfile | undefined;
      const enricher = dependencies.enrichers.find((item) =>
        item.supports(candidate)
      );
      if (enricher && !input.candidates) {
        try {
          logger.info(`${progress}: enriching from ${enricher.name}.`);
          profile = await enricher.enrich(candidate);
          logger.info(
            `${progress}: found ${profile.founders.length} founder profiles.`
          );
        } catch (error) {
          logger.error(
            `${progress}: YC profile enrichment failed (${
              error instanceof Error ? error.message : String(error)
            }). Continuing with directory data.`
          );
        }
      }
      logger.info(`${progress}: collecting evidence.`);
      const evidence = collectEvidence(candidate, profile);
      logger.info(
        dependencies.analyzer
          ? `${progress}: requesting ${dependencies.analyzer.name} analysis.`
          : `${progress}: using deterministic analysis (no OpenRouter key).`
      );
      const analysis = await analyseCandidate(
        candidate,
        evidence,
        dependencies.analyzer,
        (error) =>
          logger.error(
            `${progress}: OpenRouter analysis failed (${
              error instanceof Error ? error.message : String(error)
            }). Using deterministic analysis.`
          ),
        profile
      );
      const score = scoreAnalysis(analysis);
      const recommendation = recommend(score, evidence);
      logger.info(
        `${progress}: scored ${score.total}/100, ${recommendation.decision}.`
      );
      const slug = candidate.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      await dependencies.store.writeJson(
        run,
        `evidence/${slug}.json`,
        evidence
      );
      await dependencies.store.writeJson(run, `analysis/${slug}.json`, {
        analysis,
        score,
        recommendation,
      });
      if (profile)
        await dependencies.store.writeJson(
          run,
          `profiles/${slug}.json`,
          profile
        );
      const memoInput = {
        candidate,
        evidence,
        analysis,
        score,
        recommendation,
      };
      logger.info(`${progress}: rendering HTML memo.`);
      await dependencies.store.writeText(
        run,
        `memos/${slug}.html`,
        dependencies.renderer.renderMemo(memoInput)
      );
      reportEntries.push(memoInput);
      logger.info(`${progress}: HTML memo saved.`);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate.name}: ${message}`);
      logger.error(`${progress}: failed (${message}).`);
    }
  }
  await dependencies.store.writeJson(run, "summary.json", {
    completed,
    failed: failures.length,
    failures,
  });
  await dependencies.store.writeText(
    run,
    "report.html",
    dependencies.renderer.renderRunReport(input.topic, reportEntries)
  );
  logger.info(
    `[DealScout] Finished: ${completed} memos saved, ${failures.length} skipped.`
  );
  return { runPath: run.path, completed, failed: failures.length, failures };
}

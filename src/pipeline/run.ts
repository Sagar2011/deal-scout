import type { Candidate, RunSummary } from "../core/models.js";
import { createRun, writeJson, writeText } from "../core/storage.js";
import { analyseCandidate } from "../analysis/analysis.js";
import { OpenRouterAnalyzer, OpenRouterMemoWriter } from "../analysis/llm.js";
import { recommend } from "../analysis/recommendation.js";
import { scoreAnalysis } from "../analysis/scoring.js";
import { renderMemo } from "../reports/memo.js";
import { collectEvidence } from "../research/evidence.js";
import type { HttpClient } from "../sources/types.js";
import { discoverCandidates } from "./discover.js";

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
}): Promise<RunSummary> {
  const logger = input.logger ?? console;
  const model = input.llmModel ?? "openrouter/free";
  logger.info(`[DealScout] Starting run for "${input.topic}".`);
  const run = await createRun(input.rootDir, input.topic);
  if (!input.candidates) logger.info("[DealScout] Discovering candidates from YC and Hacker News.");
  const candidates =
    input.candidates ??
    (await discoverCandidates(input.topic, input.http, input.limit));
  logger.info(`[DealScout] Found ${candidates.length} candidates. Saving source records.`);
  await writeJson(run, "candidates.json", candidates);
  const failures: string[] = [];
  let completed = 0;
  for (const [index, candidate] of candidates.entries()) {
    const progress = `[DealScout] [${index + 1}/${candidates.length}] ${candidate.name}`;
    try {
      logger.info(`${progress}: collecting evidence.`);
      const evidence = collectEvidence(candidate);
      logger.info(
        input.llmApiKey
          ? `${progress}: requesting OpenRouter analysis with ${model}.`
          : `${progress}: using deterministic analysis (no OpenRouter key).`
      );
      const analysis = await analyseCandidate(
        candidate,
        evidence,
        input.llmApiKey
          ? new OpenRouterAnalyzer(
              input.llmApiKey,
              model
            )
          : undefined,
        (error) => logger.error(`${progress}: OpenRouter analysis failed (${error instanceof Error ? error.message : String(error)}). Using deterministic analysis.`)
      );
      const score = scoreAnalysis(analysis);
      const recommendation = recommend(score, evidence);
      logger.info(`${progress}: scored ${score.total}/100, ${recommendation.decision}.`);
      const slug = candidate.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      await writeJson(run, `evidence/${slug}.json`, evidence);
      await writeJson(run, `analysis/${slug}.json`, {
        analysis,
        score,
        recommendation,
      });
      const memoInput = {
        candidate,
        evidence,
        analysis,
        score,
        recommendation,
      };
      let memo = renderMemo(memoInput);
      if (input.llmApiKey) {
        try {
          logger.info(`${progress}: requesting OpenRouter memo with ${model}.`);
          memo = await new OpenRouterMemoWriter(
            input.llmApiKey,
            model
          ).write(memoInput);
          logger.info(`${progress}: OpenRouter memo generated.`);
        } catch (error) {
          // Preserve a reviewable memo when a model request fails.
          logger.error(`${progress}: OpenRouter memo failed (${error instanceof Error ? error.message : String(error)}). Using deterministic memo.`);
        }
      } else {
        logger.info(`${progress}: using deterministic memo (no OpenRouter key).`);
      }
      await writeText(run, `memos/${slug}.md`, memo);
      logger.info(`${progress}: memo saved.`);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate.name}: ${message}`);
      logger.error(`${progress}: failed (${message}).`);
    }
  }
  await writeJson(run, "summary.json", {
    completed,
    failed: failures.length,
    failures,
  });
  logger.info(`[DealScout] Finished: ${completed} memos saved, ${failures.length} skipped.`);
  return { runPath: run.path, completed, failed: failures.length, failures };
}

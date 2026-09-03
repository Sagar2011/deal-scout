import type {
  Candidate,
  CandidateProfile,
  ResearchBrief,
  RunSummary,
} from "../core/models.js";
import type { PipelineDependencies } from "../core/contracts.js";
import { analyseCandidate } from "../analysis/analysis.js";
import { recommend } from "../analysis/recommendation.js";
import { scoreAnalysis } from "../analysis/scoring.js";
import type { MemoInput } from "../reports/memo.js";
import { collectEvidence } from "../research/evidence.js";
import type { HttpClient } from "../sources/types.js";
import { discoverCandidatePool, discoverCandidates } from "./discover.js";
import { createDefaultDependencies } from "./defaults.js";
import {
  createFallbackResearchBrief,
  createRunThesis,
} from "../core/thesis.js";

type PipelineLogger = Pick<Console, "info" | "error">;

export async function runPipeline(input: {
  topic: string;
  rootDir: string;
  candidates?: Candidate[];
  http?: HttpClient;
  limit?: number;
  llmApiKey?: string;
  llmModel?: string;
  concurrency?: number;
  logger?: PipelineLogger;
  dependencies?: PipelineDependencies;
}): Promise<RunSummary> {
  const logger = input.logger ?? console;
  const dependencies = input.dependencies ?? createDefaultDependencies(input);
  logger.info(`[DealScout] Starting run for "${input.topic}".`);
  const run = await dependencies.store.createRun(input.rootDir, input.topic);
  const requestedCount = input.limit ?? 11;
  const brief = await buildResearchBrief(
    input.topic,
    dependencies.researchPlanner,
    logger
  );
  const thesis = createRunThesis(brief);
  await dependencies.store.writeJson(run, "research-brief.json", brief);
  await dependencies.store.writeJson(run, "thesis.json", thesis);
  if (!input.candidates)
    logger.info("[DealScout] Discovering candidates from YC and Hacker News.");
  let selection:
    | { reasons: Array<{ sourceUrl: string; reason: string }> }
    | undefined;
  let candidatePool: Candidate[] | undefined;
  const candidates = input.candidates ?? (await discover(brief));
  await dependencies.store.writeJson(run, "query-plan.json", {
    topic: input.topic,
    queries: brief.queries,
    provider: dependencies.researchPlanner?.name ?? "literal topic",
  });
  if (selection)
    await dependencies.store.writeJson(run, "selection.json", selection);
  if (candidatePool)
    await dependencies.store.writeJson(
      run,
      "candidate-pool.json",
      candidatePool
    );
  if (!input.candidates && candidates.length < requestedCount) {
    logger.error(
      `[DealScout] Found ${candidates.length}/${requestedCount} relevant candidates after all discovery passes. Continuing with the relevant candidates found.`
    );
  }
  logger.info(
    `[DealScout] Found ${candidates.length} candidates. Saving source records.`
  );
  await dependencies.store.writeJson(run, "candidates.json", candidates);
  const concurrency = normalizeConcurrency(input.concurrency);
  logger.info(
    `[DealScout] Processing ${candidates.length} candidates with concurrency ${concurrency}.`
  );
  const outcomes = await mapWithConcurrency(
    candidates,
    concurrency,
    async (candidate, index) => {
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
        for (const collector of dependencies.evidenceCollectors ?? []) {
          try {
            logger.info(`${progress}: collecting ${collector.name}.`);
            evidence.push(...(await collector.collect(candidate)));
          } catch (error) {
            logger.error(
              `${progress}: ${collector.name} failed (${
                error instanceof Error ? error.message : String(error)
              }). Continuing with captured source evidence.`
            );
          }
        }
        logger.info(
          dependencies.analyzer
            ? `${progress}: requesting ${dependencies.analyzer.name} analysis.`
            : `${progress}: using deterministic analysis (no OpenRouter key).`
        );
        const analysis = await analyseCandidate(
          candidate,
          evidence,
          thesis,
          dependencies.analyzer,
          (error) =>
            logger.error(
              `${progress}: OpenRouter analysis failed (${
                error instanceof Error ? error.message : String(error)
              }). Using deterministic analysis.`
            ),
          profile
        );
        const score = scoreAnalysis(analysis, {
          candidate,
          evidence,
          profile,
          thesis,
        });
        const recommendation = recommend(score, evidence, thesis);
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
          profile,
          thesis,
        };
        logger.info(`${progress}: rendering HTML memo.`);
        await dependencies.store.writeText(
          run,
          `memos/${slug}.html`,
          dependencies.renderer.renderMemo(memoInput)
        );
        logger.info(`${progress}: HTML memo saved.`);
        return { memoInput };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${progress}: failed (${message}).`);
        return { failure: `${candidate.name}: ${message}` };
      }
    }
  );
  const reportEntries = outcomes.flatMap((outcome) =>
    outcome.memoInput ? [outcome.memoInput] : []
  );
  const failures = outcomes.flatMap((outcome) =>
    outcome.failure ? [outcome.failure] : []
  );
  const completed = reportEntries.length;
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

  async function discover(researchBrief: ResearchBrief): Promise<Candidate[]> {
    if (!dependencies.candidateSelector)
      return discoverCandidates(
        researchBrief.queries,
        dependencies.sources,
        requestedCount,
        input.topic
      );
    const pool = await discoverCandidatePool(
      researchBrief.queries,
      dependencies.sources,
      requestedCount,
      input.topic
    );
    candidatePool = pool;
    try {
      logger.info(
        `[DealScout] Selecting topic-relevant candidates with ${dependencies.candidateSelector.name}.`
      );
      const result = await dependencies.candidateSelector.select(
        researchBrief,
        pool,
        requestedCount
      );
      selection = { reasons: result.reasons };
      return result.candidates;
    } catch (error) {
      logger.error(
        `[DealScout] Candidate selection failed (${
          error instanceof Error ? error.message : String(error)
        }). Using deterministic relevance filtering.`
      );
      return discoverCandidates(
        researchBrief.queries,
        dependencies.sources,
        requestedCount,
        input.topic
      );
    }
  }
}

async function buildResearchBrief(
  topic: string,
  planner: PipelineDependencies["researchPlanner"],
  logger: PipelineLogger
): Promise<ResearchBrief> {
  if (!planner) return createFallbackResearchBrief(topic);
  try {
    logger.info(`[DealScout] Interpreting the topic with ${planner.name}.`);
    const brief = await planner.plan(topic);
    return {
      ...brief,
      // The literal request is always searched; LLM expansions improve recall but cannot replace it.
      queries: uniqueQueries([topic, ...brief.queries]),
    };
  } catch (error) {
    logger.error(
      `[DealScout] Topic interpretation failed (${
        error instanceof Error ? error.message : String(error)
      }). Using the literal topic.`
    );
    return createFallbackResearchBrief(topic);
  }
}

function uniqueQueries(queries: string[]): string[] {
  return [
    ...new Map(
      queries
        .map((query) => query.trim())
        .filter(Boolean)
        .map((query) => [query.toLowerCase(), query])
    ).values(),
  ];
}

function normalizeConcurrency(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 3;
  return Math.max(1, Math.floor(value));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runWorker)
  );
  return results;
}

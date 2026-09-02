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
  concurrency?: number;
  logger?: PipelineLogger;
  dependencies?: PipelineDependencies;
}): Promise<RunSummary> {
  const logger = input.logger ?? console;
  const dependencies = input.dependencies ?? createDefaultDependencies(input);
  logger.info(`[DealScout] Starting run for "${input.topic}".`);
  const run = await dependencies.store.createRun(input.rootDir, input.topic);
  const requestedCount = input.limit ?? 11;
  let queries = await buildQueryPlan(
    input.topic,
    dependencies.queryExpander,
    logger
  );
  if (!input.candidates)
    logger.info("[DealScout] Discovering candidates from YC and Hacker News.");
  let candidates =
    input.candidates ??
    (await discoverCandidates(
      queries,
      dependencies.sources,
      requestedCount,
      input.topic
    ));
  if (
    !input.candidates &&
    candidates.length < requestedCount &&
    dependencies.queryExpander
  ) {
    logger.info(
      `[DealScout] Found ${candidates.length}/${requestedCount} candidates. Expanding discovery once more.`
    );
    queries = uniqueQueries([
      ...queries,
      ...(await expandQueries(
        input.topic,
        dependencies.queryExpander,
        queries,
        logger
      )),
    ]);
    candidates = await discoverCandidates(
      queries,
      dependencies.sources,
      requestedCount,
      input.topic
    );
  }
  await dependencies.store.writeJson(run, "query-plan.json", {
    topic: input.topic,
    queries,
    provider: dependencies.queryExpander?.name ?? "literal topic",
  });
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
        const score = scoreAnalysis(analysis, { candidate, evidence, profile });
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
          profile,
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
}

async function buildQueryPlan(
  topic: string,
  expander: PipelineDependencies["queryExpander"],
  logger: PipelineLogger
): Promise<string[]> {
  if (!expander) return [topic];
  return uniqueQueries([
    topic,
    ...(await expandQueries(topic, expander, [], logger)),
  ]);
}

async function expandQueries(
  topic: string,
  expander: NonNullable<PipelineDependencies["queryExpander"]>,
  excludedQueries: string[],
  logger: PipelineLogger
): Promise<string[]> {
  try {
    logger.info(
      `[DealScout] Expanding source queries with ${expander.name}${
        excludedQueries.length ? " (second pass)" : ""
      }.`
    );
    return await expander.expand(topic, excludedQueries);
  } catch (error) {
    logger.error(
      `[DealScout] Query expansion failed (${
        error instanceof Error ? error.message : String(error)
      }). Using the existing query plan.`
    );
    return [];
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

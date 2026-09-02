import type { Candidate, RunSummary } from "../core/models.js";
import { createRun, writeJson, writeText } from "../core/storage.js";
import { analyseCandidate } from "../analysis/analysis.js";
import { OpenAiAnalyzer, OpenAiMemoWriter } from "../analysis/llm.js";
import { recommend } from "../analysis/recommendation.js";
import { scoreAnalysis } from "../analysis/scoring.js";
import { renderMemo } from "../reports/memo.js";
import { collectEvidence } from "../research/evidence.js";
import type { HttpClient } from "../sources/types.js";
import { discoverCandidates } from "./discover.js";

export async function runPipeline(input: { topic: string; rootDir: string; candidates?: Candidate[]; http?: HttpClient; limit?: number; llmApiKey?: string }): Promise<RunSummary> {
  const run = await createRun(input.rootDir, input.topic);
  const candidates = input.candidates ?? await discoverCandidates(input.topic, input.http, input.limit);
  await writeJson(run, "candidates.json", candidates);
  const failures: string[] = [];
  let completed = 0;
  for (const candidate of candidates) {
    try {
      const evidence = collectEvidence(candidate);
      const analysis = await analyseCandidate(candidate, evidence, input.llmApiKey ? new OpenAiAnalyzer(input.llmApiKey) : undefined);
      const score = scoreAnalysis(analysis);
      const recommendation = recommend(score, evidence);
      const slug = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await writeJson(run, `evidence/${slug}.json`, evidence);
      await writeJson(run, `analysis/${slug}.json`, { analysis, score, recommendation });
      const memoInput = { candidate, evidence, analysis, score, recommendation };
      let memo = renderMemo(memoInput);
      if (input.llmApiKey) {
        try {
          memo = await new OpenAiMemoWriter(input.llmApiKey).write(memoInput);
        } catch {
          // Preserve a reviewable memo when a model request fails.
        }
      }
      await writeText(run, `memos/${slug}.md`, memo);
      completed += 1;
    } catch (error) {
      failures.push(`${candidate.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await writeJson(run, "summary.json", { completed, failed: failures.length, failures });
  return { runPath: run.path, completed, failed: failures.length, failures };
}

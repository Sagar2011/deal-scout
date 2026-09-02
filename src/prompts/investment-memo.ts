import type { Candidate, Evidence, Recommendation, Score, StartupAnalysis } from "../core/models.js";

export type MemoPromptInput = { candidate: Candidate; evidence: Evidence[]; analysis: StartupAnalysis; score: Score; recommendation: Recommendation };

export function buildMemoPrompt(input: MemoPromptInput): string {
  return `Write a concise internal investment memo in Markdown. Preserve the supplied score and recommendation exactly. Use only the supplied analysis and evidence. Cite factual claims as Markdown links using the evidence URLs. Include Product, Team, Market, Risks / Open Questions, Score, Recommendation, What would change our mind, and Sources. Do not add unsupported claims.\n\nCandidate:\n${JSON.stringify(input.candidate, null, 2)}\n\nEvidence:\n${JSON.stringify(input.evidence, null, 2)}\n\nAnalysis:\n${JSON.stringify(input.analysis, null, 2)}\n\nScore:\n${input.score.total}/100\n\nRecommendation:\n${JSON.stringify(input.recommendation, null, 2)}`;
}

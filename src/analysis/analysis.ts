import type { Candidate, Evidence, StartupAnalysis } from "../core/models.js";

type LlmAnalyzer = {
  analyse(candidate: Candidate, evidence: Evidence[]): Promise<StartupAnalysis>;
};

export async function analyseCandidate(
  candidate: Candidate,
  evidence: Evidence[],
  llm?: LlmAnalyzer,
  onLlmError?: (error: unknown) => void
): Promise<StartupAnalysis> {
  if (llm) {
    try {
      return await llm.analyse(candidate, evidence);
    } catch (error) {
      // A failed model call must not erase source-backed deterministic output.
      onLlmError?.(error);
    }
  }

  const text = `${candidate.description} ${candidate.signal}`.toLowerCase();
  const smbFit = /small business|small businesses|smb/.test(text) ? 0.9 : 0.2;
  const workflowClarity = /automat|workflow|agent/.test(text) ? 0.8 : 0.2;
  const hnPoints = Number(candidate.signal.match(/(\d+) HN points/)?.[1] ?? 0);
  const signalStrength = candidate.source === "Hacker News"
    ? hnPoints >= 100 ? 0.6 : hnPoints >= 20 ? 0.4 : 0.2
    : 0.3;
  return {
    team: "Founder background is not available from the collected public source data.",
    product: candidate.description,
    market:
      "The collected source does not establish the initial market.",
    traction: candidate.signal,
    risks: ["Company claims have not been independently validated."],
    openQuestions: [
      "Who are the founders and what is their relevant operating experience?",
      "What evidence supports retention and willingness to pay?",
    ],
    criteria: {
      workflowClarity,
      smbFit,
      technicalDepth: 0.2,
      signalStrength,
      whyNow: /ai|agent/.test(text) ? 0.8 : 0.5,
    },
  };
}

import type { Candidate, Evidence, StartupAnalysis } from "../core/models.js";

type LlmAnalyzer = { analyse(candidate: Candidate, evidence: Evidence[]): Promise<StartupAnalysis> };

export async function analyseCandidate(candidate: Candidate, evidence: Evidence[], llm?: LlmAnalyzer): Promise<StartupAnalysis> {
  if (llm) {
    try {
      return await llm.analyse(candidate, evidence);
    } catch {
      // A failed model call must not erase source-backed deterministic output.
    }
  }

  const text = `${candidate.description} ${candidate.signal}`.toLowerCase();
  const smbFit = /small business|small businesses|smb/.test(text) ? 0.9 : 0.4;
  const workflowClarity = /automat|workflow|agent/.test(text) ? 0.8 : 0.5;
  return {
    team: "Founder background is not available from the collected public source data.",
    product: candidate.description,
    market: "The initial market is inferred from the company description and needs validation.",
    traction: candidate.signal,
    risks: ["Company claims have not been independently validated."],
    openQuestions: ["Who are the founders and what is their relevant operating experience?", "What evidence supports retention and willingness to pay?"],
    criteria: { workflowClarity, smbFit, technicalDepth: 0.4, signalStrength: evidence.length >= 2 ? 0.6 : 0.3, whyNow: /ai|agent/.test(text) ? 0.8 : 0.5 },
  };
}

import type { Candidate, Evidence } from "../core/models.js";

export function buildAnalysisPrompt(
  candidate: Candidate,
  evidence: Evidence[]
): string {
  return `You are preparing an internal seed-investment analysis. Return JSON only with: team, product, market, traction, risks, openQuestions, criteria. Criteria must contain workflowClarity, smbFit, technicalDepth, signalStrength, whyNow as numbers from 0 to 1. Use only the supplied evidence. State unknowns as open questions; never invent founder, funding, customer, or market claims.\n\nCandidate:\n${JSON.stringify(
    candidate,
    null,
    2
  )}\n\nEvidence:\n${JSON.stringify(evidence, null, 2)}`;
}

import type { Candidate, Evidence } from "../core/models.js";
import type { RunThesis } from "../core/thesis.js";

export function buildAnalysisPrompt(
  candidate: Candidate,
  evidence: Evidence[],
  thesis: RunThesis
): string {
  return `You are preparing an internal seed-investment analysis. Return JSON only with: team, product, market, traction, risks, openQuestions, criteria. Criteria must contain workflowClarity, topicFit, technicalDepth, signalStrength, whyNow as one of 0, 0.25, 0.5, 0.75, or 1. Use only the supplied evidence. State unknowns as open questions; never invent founder, funding, customer, or market claims. The pipeline independently calibrates the final score from saved evidence.\n\nRun thesis:\n${JSON.stringify(
    thesis,
    null,
    2
  )}\n\nCandidate:\n${JSON.stringify(
    candidate,
    null,
    2
  )}\n\nEvidence:\n${JSON.stringify(evidence, null, 2)}`;
}

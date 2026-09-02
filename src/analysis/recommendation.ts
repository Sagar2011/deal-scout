import type { Evidence, Recommendation, Score } from "../core/models.js";

export function recommend(score: Score, evidence: Evidence[]): Recommendation {
  const decision =
    score.total >= 75 && evidence.length >= 2
      ? "Take a meeting"
      : score.total >= 50
      ? "Watch"
      : "Pass";
  return {
    decision,
    rationale: `${score.total}/100 against the current SMB AI-agent thesis with ${evidence.length} captured evidence records.`,
    mindChanges: [
      "Verify founder background and technical depth.",
      "Verify customer retention and willingness to pay.",
      "Validate that the workflow produces measurable ROI.",
    ],
  };
}

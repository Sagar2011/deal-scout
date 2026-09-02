import type { Evidence, Recommendation, Score } from "../core/models.js";
import type { RunThesis } from "../core/thesis.js";

export function recommend(
  score: Score,
  evidence: Evidence[],
  thesis?: RunThesis
): Recommendation {
  const technicalDepth = score.breakdown.find(
    (item) => item.label === "Technical depth"
  )?.score;
  const signalStrength = score.breakdown.find(
    (item) => item.label === "Signal strength"
  )?.score;
  const hasEvidenceToWatch =
    evidence.length >= 4 && Boolean(technicalDepth) && Boolean(signalStrength);
  const decision =
    score.total >= 75 && hasEvidenceToWatch
      ? "Take a meeting"
      : score.total >= 50 && hasEvidenceToWatch
      ? "Watch"
      : "Pass";
  return {
    decision,
    rationale: `${score.total}/100 against ${thesis?.topic ?? "the selected"} thesis with ${evidence.length} captured evidence records.`,
    mindChanges: [
      "Verify founder background and technical depth.",
      "Verify customer retention and willingness to pay.",
      "Validate that the workflow produces measurable ROI.",
    ],
  };
}

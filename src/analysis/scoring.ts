import type { Score, StartupAnalysis } from "../core/models.js";

export function scoreAnalysis(analysis: StartupAnalysis): Score {
  const { workflowClarity, smbFit, technicalDepth, signalStrength, whyNow } =
    analysis.criteria;
  const breakdown = [
    {
      label: "Workflow clarity",
      score: Math.round(workflowClarity * 25),
      maximum: 25,
    },
    { label: "SMB fit", score: Math.round(smbFit * 20), maximum: 20 },
    {
      label: "Technical depth",
      score: Math.round(technicalDepth * 20),
      maximum: 20,
    },
    {
      label: "Signal strength",
      score: Math.round(signalStrength * 20),
      maximum: 20,
    },
    { label: "Why now", score: Math.round(whyNow * 15), maximum: 15 },
  ];
  const total = breakdown.reduce((sum, item) => sum + item.score, 0);
  return {
    total,
    reasons: breakdown.map((item) => item.label),
    breakdown,
  };
}

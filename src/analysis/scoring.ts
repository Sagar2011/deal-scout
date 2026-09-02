import type { Score, StartupAnalysis } from "../core/models.js";

export function scoreAnalysis(analysis: StartupAnalysis): Score {
  const { workflowClarity, smbFit, technicalDepth, signalStrength, whyNow } =
    analysis.criteria;
  const total = Math.round(
    workflowClarity * 25 +
      smbFit * 20 +
      technicalDepth * 20 +
      signalStrength * 20 +
      whyNow * 15
  );
  return {
    total,
    reasons: [
      "Workflow clarity",
      "SMB fit",
      "Technical depth",
      "Signal strength",
      "Why now",
    ],
  };
}

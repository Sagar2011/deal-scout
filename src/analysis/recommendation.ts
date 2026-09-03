import type {
  Candidate,
  CandidateProfile,
  Evidence,
  Recommendation,
  Score,
} from "../core/models.js";
import type { RunThesis } from "../core/thesis.js";

type RecommendationContext = {
  candidate?: Candidate;
  profile?: CandidateProfile;
};

export function recommend(
  score: Score,
  evidence: Evidence[],
  thesis?: RunThesis,
  context: RecommendationContext = {}
): Recommendation {
  const technicalDepth = score.breakdown.find(
    (item) => item.label === "Technical depth"
  )?.score;
  const signalStrength = score.breakdown.find(
    (item) => item.label === "Signal strength"
  )?.score;
  const independentEvidenceUrls = new Set(
    evidence.map((item) => item.url)
  ).size;
  const hasEvidenceToWatch =
    independentEvidenceUrls >= 2 &&
    Boolean(technicalDepth) &&
    Boolean(signalStrength);
  const decision =
    score.total >= 75 && hasEvidenceToWatch
      ? "Take a meeting"
      : score.total >= 50 && hasEvidenceToWatch
      ? "Watch"
      : "Pass";
  const { candidate, profile } = context;
  const founderCount = profile?.founders.length ?? 0;
  const rationale = candidate
    ? `${candidate.name} has a defined workflow (${candidate.description}) and ${founderCount ? `public founder evidence for ${founderCount} ${founderCount === 1 ? "founder" : "founders"}` : "no public founder profile"}. The current record does not establish customer adoption, retention, or market-timing evidence.`
    : `${score.total}/100 against ${
        thesis?.topic ?? "the selected"
      } thesis with ${evidence.length} captured evidence records.`;
  const mindChanges = candidate
    ? [
        `Confirm ${candidate.name}'s paid customer adoption and retention.`,
        `Validate measurable ROI for ${candidate.description.toLowerCase()}.`,
        founderCount
          ? "Validate the founding team's direct experience in this workflow."
          : "Verify the founding team's relevant operating and technical depth.",
      ]
    : [
        "Verify founder background and technical depth.",
        "Verify customer retention and willingness to pay.",
        "Validate that the workflow produces measurable ROI.",
      ];
  return {
    decision,
    rationale,
    mindChanges,
  };
}

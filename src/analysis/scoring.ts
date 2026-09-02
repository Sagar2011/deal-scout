import type {
  Candidate,
  CandidateProfile,
  Evidence,
  Score,
  StartupAnalysis,
} from "../core/models.js";

type ScoreContext = {
  candidate: Candidate;
  evidence: Evidence[];
  profile?: CandidateProfile;
};

export function scoreAnalysis(
  analysis: StartupAnalysis,
  context?: ScoreContext
): Score {
  const { workflowClarity, smbFit, technicalDepth, signalStrength, whyNow } =
    context ? evidenceCriteria(context) : analysis.criteria;
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
    method: context ? "Evidence calibration" : "LLM criteria",
    reasons: breakdown.map((item) => item.label),
    breakdown,
  };
}

function evidenceCriteria(context: ScoreContext): StartupAnalysis["criteria"] {
  const text = [
    context.candidate.description,
    context.candidate.signal,
    context.profile?.description,
    ...context.evidence.map((item) => item.claim),
    ...(context.profile?.founders.map((founder) => founder.bio) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasFounderSignal = Boolean(context.profile?.founders.length);
  const hasTechnicalSignal =
    /engineer|engineering|software|developer|technical|computer science/.test(
      text
    );
  const hnPoints = Number(
    context.candidate.signal.match(/(\d+) HN points/)?.[1] ?? 0
  );
  return {
    workflowClarity: /automat|workflow|agent/.test(text) ? 0.75 : 0.25,
    smbFit: /small business|small businesses|smb/.test(text) ? 0.75 : 0.25,
    technicalDepth: hasFounderSignal && hasTechnicalSignal ? 0.5 : 0.25,
    signalStrength:
      context.candidate.source === "Hacker News"
        ? hnPoints >= 100
          ? 0.75
          : hnPoints >= 20
          ? 0.5
          : 0.25
        : /hiring|employees|funding|raised|launch|customer|revenue/.test(text)
        ? 0.5
        : 0.25,
    whyNow: /ai|agent/.test(text) ? 0.75 : 0.5,
  };
}

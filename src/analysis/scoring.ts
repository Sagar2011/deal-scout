import type {
  Candidate,
  CandidateProfile,
  Evidence,
  Score,
  StartupAnalysis,
} from "../core/models.js";
import type { RunThesis } from "../core/thesis.js";

type ScoreContext = {
  candidate: Candidate;
  evidence: Evidence[];
  profile?: CandidateProfile;
  thesis?: RunThesis;
};

export function scoreAnalysis(
  analysis: StartupAnalysis,
  context?: ScoreContext
): Score {
  const { workflowClarity, topicFit, technicalDepth, signalStrength, whyNow } =
    context ? evidenceCriteria(context) : analysis.criteria;
  const breakdown = [
    {
      label: "Workflow clarity",
      score: Math.round(workflowClarity * 25),
      maximum: 25,
    },
    {
      label: context?.thesis?.fitLabel ?? "Topic fit",
      score: Math.round(topicFit * 20),
      maximum: 20,
    },
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
    workflowClarity: /automat|workflow|agent/.test(text) ? 0.75 : 0,
    topicFit: context.thesis ? topicFit(text, context.thesis.topic) : 0,
    technicalDepth: hasFounderSignal && hasTechnicalSignal ? 0.5 : 0,
    signalStrength:
      context.candidate.source === "Hacker News"
        ? hnPoints >= 100
          ? 0.75
          : hnPoints >= 20
          ? 0.5
          : 0
        : /hiring|employees|funding|raised|launch|customer|revenue/.test(text)
        ? 0.5
        : 0,
    // This version has no dedicated market-timing source, so it cannot defend a
    // numeric why-now claim from product copy or a company listing alone.
    whyNow: 0,
  };
}

function topicFit(text: string, topic: string): number {
  const terms = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && term !== "startup");
  return terms.length > 0 && terms.every((term) => text.includes(term.slice(0, 5)))
    ? 0.75
    : 0;
}

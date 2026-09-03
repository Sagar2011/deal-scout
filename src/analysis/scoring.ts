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
  const hnPoints = Number(
    context.candidate.signal.match(/(\d+) HN points/)?.[1] ?? 0
  );
  const agentClaimIsUncorroborated =
    requiresAgentEvidence(context.thesis) &&
    companyWebsiteContradictsAgentClaim(context.evidence);
  const workflowClarity = Math.min(1, workflowSignalCount(text) / 4);
  const fit = context.thesis ? topicFit(text, context.thesis) : 0;
  return {
    // A directory may call a product an agent while its own site describes a
    // non-agent product. Treat that claim as unconfirmed rather than scoring it fully.
    workflowClarity: agentClaimIsUncorroborated
      ? Math.min(workflowClarity, 0.6)
      : workflowClarity,
    topicFit: agentClaimIsUncorroborated ? Math.min(fit, 0.6) : fit,
    technicalDepth: Math.min(
      1,
      technicalFounderSignalCount(context.profile) * 0.3
    ),
    signalStrength:
      context.candidate.source === "Hacker News"
        ? hackerNewsSignal(hnPoints)
        : ycSignal(context),
    // This version has no dedicated market-timing source, so it cannot defend a
    // numeric why-now claim from product copy or a company listing alone.
    whyNow: 0,
  };
}

function requiresAgentEvidence(thesis?: RunThesis): boolean {
  return /\bagent(?:s|ic)?\b/i.test(thesis?.topic ?? "");
}

function companyWebsiteContradictsAgentClaim(evidence: Evidence[]): boolean {
  const websiteClaims = evidence
    .filter((item) => item.source === "Company website")
    .map((item) => item.claim.toLowerCase());
  return websiteClaims.some(
    (claim) =>
      !/\bagent(?:s|ic)?\b/.test(claim) &&
      /\b(?:assistant|copilot|documentation platform)\b/.test(claim)
  );
}

function topicFit(text: string, thesis: RunThesis): number {
  return Math.max(
    phraseCoverage(text, thesis.topic),
    ...thesis.fitQueries.map((query) => phraseCoverage(text, query))
  );
}

function phraseCoverage(text: string, phrase: string): number {
  const terms = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (term) =>
        term.length > 2 &&
        !["and", "for", "startup", "startups", "with"].includes(term)
    );
  if (!terms.length) return 0;
  const matches = terms.filter((term) => text.includes(term.slice(0, 5)));
  return matches.length / terms.length;
}

function workflowSignalCount(text: string): number {
  return [
    "agent",
    "automat",
    "workflow",
    "billing",
    "coding",
    "document",
    "follow-up",
    "intake",
    "invoice",
    "operation",
    "schedul",
  ].filter((term) => text.includes(term)).length;
}

function technicalFounderSignalCount(profile?: CandidateProfile): number {
  const founderText = (
    profile?.founders.map((founder) => founder.bio).join(" ") ?? ""
  ).toLowerCase();
  return [
    /computer science/,
    /develop/,
    /engineer(?:ing)?/,
    /technical/,
  ].filter((pattern) => pattern.test(founderText)).length;
}

function hackerNewsSignal(points: number): number {
  if (points >= 500) return 0.9;
  if (points >= 100) return 0.7;
  if (points >= 20) return 0.45;
  return 0;
}

function ycSignal(context: ScoreContext): number {
  if (!context.evidence.length) return 0;
  const year = ycBatchYear(context.candidate.signal);
  const currentYear = new Date().getUTCFullYear();
  const freshness =
    year === undefined
      ? 0
      : year >= currentYear
      ? 0.35
      : year === currentYear - 1
      ? 0.3
      : year === currentYear - 2
      ? 0.2
      : 0.1;
  const teamSize = context.profile?.teamSize ?? 0;
  const teamSignal =
    teamSize >= 10 ? 0.2 : teamSize >= 5 ? 0.15 : teamSize >= 2 ? 0.1 : 0;
  const sourceDiversity =
    new Set(context.evidence.map((item) => item.url)).size >= 2 ? 0.1 : 0;
  return Math.min(0.75, freshness + teamSignal + sourceDiversity);
}

function ycBatchYear(signal: string): number | undefined {
  const match = signal.match(
    /(?:Winter|Spring|Summer|Fall)\s+(\d{4})|\b[WSF](\d{2})\b/i
  );
  const rawYear = match?.[1] ?? match?.[2];
  if (!rawYear) return undefined;
  return rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
}

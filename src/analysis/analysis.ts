import type {
  Candidate,
  CandidateProfile,
  Evidence,
  StartupAnalysis,
} from "../core/models.js";
import type { RunThesis } from "../core/thesis.js";
import { createRunThesis } from "../core/thesis.js";

type LlmAnalyzer = {
  analyse(
    candidate: Candidate,
    evidence: Evidence[],
    thesis: RunThesis
  ): Promise<StartupAnalysis>;
};

export async function analyseCandidate(
  candidate: Candidate,
  evidence: Evidence[],
  thesis: RunThesis = createRunThesis("startup"),
  llm?: LlmAnalyzer,
  onLlmError?: (error: unknown) => void,
  profile?: CandidateProfile
): Promise<StartupAnalysis> {
  if (llm) {
    try {
      return await llm.analyse(candidate, evidence, thesis);
    } catch (error) {
      // A failed model call must not erase source-backed deterministic output.
      onLlmError?.(error);
    }
  }

  const text = `${profile?.description ?? candidate.description} ${
    candidate.signal
  } ${
    profile?.founders.map((founder) => founder.bio).join(" ") ?? ""
  }`.toLowerCase();
  const topicFit = topicMatches(text, thesis.topic) ? 0.9 : 0;
  const workflowClarity = /automat|workflow|agent/.test(text) ? 0.8 : 0.2;
  const hnPoints = Number(candidate.signal.match(/(\d+) HN points/)?.[1] ?? 0);
  const signalStrength =
    candidate.source === "Hacker News"
      ? hnPoints >= 100
        ? 0.6
        : hnPoints >= 20
        ? 0.4
        : 0.2
      : 0.3;
  return {
    team: profile?.founders.length
      ? profile.founders
          .map(
            (founder) => `${founder.name} (${founder.title}): ${founder.bio}`
          )
          .join(" ")
      : "Founder background is not available from the collected public source data.",
    product: profile?.description ?? candidate.description,
    market: "The collected source does not establish the initial market.",
    traction: candidate.signal,
    risks: ["Company claims have not been independently validated."],
    openQuestions: [
      "Who are the founders and what is their relevant operating experience?",
      "What evidence supports retention and willingness to pay?",
    ],
    criteria: {
      workflowClarity,
      topicFit,
      technicalDepth:
        /engineer|engineering|software|developer|technical|computer science/.test(
          text
        )
          ? 0.5
          : 0.2,
      signalStrength,
      whyNow: /ai|agent/.test(text) ? 0.8 : 0.5,
    },
  };
}

function topicMatches(text: string, topic: string): boolean {
  const terms = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && term !== "startup");
  return terms.length > 0 && terms.every((term) => text.includes(term.slice(0, 5)));
}

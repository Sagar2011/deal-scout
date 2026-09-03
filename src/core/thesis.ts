import type { ResearchBrief } from "./models.js";

const GENERIC_QUERY_TERMS = new Set([
  "and",
  "app",
  "apps",
  "company",
  "companies",
  "for",
  "platform",
  "startup",
  "startups",
  "the",
  "with",
]);

export type RunThesis = {
  topic: string;
  statement: string;
  fitLabel: string;
};

export function createRunThesis(topic: string | ResearchBrief): RunThesis {
  const focus = typeof topic === "string" ? topic.trim() : topic.topic.trim();
  return {
    topic: focus,
    statement:
      typeof topic === "string"
        ? `Seed-stage startups addressing ${focus}, prioritizing a clearly evidenced workflow, direct topic fit, technical execution, credible public signals, and traceable market timing.`
        : topic.thesis,
    fitLabel: `${toTitleCase(focus)} fit`,
  };
}

export function createFallbackResearchBrief(topic: string): ResearchBrief {
  const focus = topic.trim();
  const narrowedQuery = focus
    .split(/[^a-z0-9]+/i)
    .filter(
      (term) => term.length > 1 && !GENERIC_QUERY_TERMS.has(term.toLowerCase())
    )
    .join(" ");
  return {
    topic: focus,
    thesis: `Seed-stage startups addressing ${focus}, prioritizing a clearly evidenced workflow, direct topic fit, technical execution, credible public signals, and traceable market timing.`,
    targetCustomer: "Not inferred without an LLM research planner.",
    inclusionCriteria: ["Directly addresses the supplied topic."],
    exclusions: ["Investor, funding, accelerator, and event content."],
    queries: [...new Set([focus, narrowedQuery].filter(Boolean))],
  };
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

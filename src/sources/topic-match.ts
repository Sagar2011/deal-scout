const GENERIC_TERMS = new Set([
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
const GENERIC_EXPANSION_TERMS = new Set([
  "agent",
  "agents",
  "ai",
  "automation",
  "automated",
  "application",
  "demand",
  "digital",
  "infrastructure",
  "modern",
  "on",
  "platform",
  "processing",
  "service",
  "services",
  "solution",
  "software",
  "tool",
  "tools",
]);
const AI_INTENT_TERMS = new Set([
  "agent",
  "agents",
  "agentic",
  "ai",
  "assistant",
  "automation",
  "automated",
  "autonomous",
]);
const QUALIFIER_TERMS = new Set([
  "b2b",
  "b2c",
  "consumer",
  "enterprise",
  "midmarket",
  "small",
]);
const CRITERION_NOISE_TERMS = new Set([
  "acting",
  "addresses",
  "component",
  "core",
  "directly",
  "early",
  "from",
  "into",
  "operates",
  "product",
  "rather",
  "sells",
  "stage",
  "suitable",
  "than",
  "the",
  "topic",
  "within",
]);

export function matchesTopic(text: string, topic: string): boolean {
  return topicRelevance(text, topic) > 0;
}

export function matchesAllTopicTerms(text: string, topic: string): boolean {
  const terms = topicTerms(topic);
  return terms.length > 0 && topicRelevance(text, topic) === terms.length;
}

export function matchesStrongExpandedTopic(
  text: string,
  topic: string
): boolean {
  const terms = topicTerms(topic);
  const normalizedText = text.toLowerCase();
  const matchedTerms = terms.filter((term) =>
    termPattern(term).test(normalizedText)
  );
  const contextTerms = terms.filter(
    (term) => !GENERIC_EXPANSION_TERMS.has(term)
  );
  // Generated queries include descriptive modifiers. Require all domain anchors,
  // while allowing those modifiers to differ from a company's wording.
  return contextTerms.length > 0
    ? contextTerms.every((term) => termPattern(term).test(normalizedText))
    : matchedTerms.length >= Math.min(2, terms.length);
}

export function matchesPlannedTopic(text: string, topic: string): boolean {
  const terms = topicTerms(topic);
  const normalizedText = text.toLowerCase();
  const intentTerms = terms.filter((term) => AI_INTENT_TERMS.has(term));
  const domainTerms = terms.filter(
    (term) => !AI_INTENT_TERMS.has(term) && !GENERIC_EXPANSION_TERMS.has(term)
  );
  const qualifierTerms = domainTerms.filter((term) =>
    QUALIFIER_TERMS.has(term)
  );

  if (!intentTerms.length) return matchesStrongExpandedTopic(text, topic);

  return (
    intentTerms.every((term) => termPattern(term).test(normalizedText)) &&
    domainTerms.some((term) => termPattern(term).test(normalizedText)) &&
    qualifierTerms.every((term) => termPattern(term).test(normalizedText))
  );
}

export function matchesResearchCriteria(
  text: string,
  inclusionCriteria: string[]
): boolean {
  // A multi-criterion LLM brief is available during fallback. Requiring two
  // criteria avoids accepting a company just because it uses AI terminology.
  const hasAiCriterion = inclusionCriteria.some((criterion) =>
    /\b(?:ai|artificial intelligence|machine learning)\b/i.test(criterion)
  );
  if (inclusionCriteria.length < 2 || !hasAiCriterion) return true;
  const normalizedText = text.toLowerCase();
  return (
    inclusionCriteria.filter((criterion) =>
      matchesResearchCriterion(normalizedText, criterion)
    ).length >= 2
  );
}

export function topicRelevance(text: string, topic: string): number {
  const terms = topicTerms(topic);
  if (!terms.length) return 1;
  const normalizedText = text.toLowerCase();
  return terms.filter((term) => termPattern(term).test(normalizedText)).length;
}

function topicTerms(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !GENERIC_TERMS.has(term))
    .map((term) => (term.endsWith("ss") ? term : term.replace(/s$/, "")));
}

function matchesResearchCriterion(text: string, criterion: string): boolean {
  if (/\b(?:ai|artificial intelligence|machine learning)\b/i.test(criterion))
    return /\b(?:ai|artificial intelligence|machine learning)\b/.test(text);
  const terms = topicTerms(criterion).filter(
    (term) =>
      !GENERIC_EXPANSION_TERMS.has(term) && !CRITERION_NOISE_TERMS.has(term)
  );
  return terms.some((term) => termPattern(term).test(text));
}

function termPattern(term: string): RegExp {
  if (term.endsWith("ss")) {
    return new RegExp(`\\b${escapeRegex(term)}(?:es)?\\b`);
  }
  if (term.endsWith("ing")) {
    const stem = term.slice(0, -3);
    return new RegExp(`\\b${escapeRegex(stem)}(?:e|es|ing|s)?\\b`);
  }
  return new RegExp(`\\b${escapeRegex(term)}s?\\b`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

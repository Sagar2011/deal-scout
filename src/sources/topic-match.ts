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
  "software",
  "tool",
  "tools",
]);

export function matchesTopic(text: string, topic: string): boolean {
  return topicRelevance(text, topic) > 0;
}

export function matchesAllTopicTerms(text: string, topic: string): boolean {
  const terms = topicTerms(topic);
  return terms.length > 0 && topicRelevance(text, topic) === terms.length;
}

export function matchesStrongExpandedTopic(text: string, topic: string): boolean {
  const terms = topicTerms(topic);
  const normalizedText = text.toLowerCase();
  const matchedTerms = terms.filter((term) =>
    termPattern(term).test(normalizedText)
  );
  const contextTerms = terms.filter(
    (term) => !GENERIC_EXPANSION_TERMS.has(term)
  );
  return (
    matchedTerms.length >= Math.min(2, terms.length) &&
    (!contextTerms.length ||
      contextTerms.every((term) => termPattern(term).test(normalizedText)))
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

function termPattern(term: string): RegExp {
  if (term.endsWith("ss")) {
    return new RegExp(`\\b${escapeRegex(term)}(?:es)?\\b`);
  }
  if (term.endsWith("ing")) {
    const stem = term.slice(0, -3);
    return new RegExp(`\\b${escapeRegex(stem)}(?:e|es|ing)\\b`);
  }
  return new RegExp(`\\b${escapeRegex(term)}s?\\b`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

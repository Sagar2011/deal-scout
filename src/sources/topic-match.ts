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

export function matchesTopic(text: string, topic: string): boolean {
  return topicRelevance(text, topic) > 0;
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
    .map((term) => term.replace(/s$/, ""));
}

function termPattern(term: string): RegExp {
  if (term.endsWith("ing")) {
    const stem = term.slice(0, -3);
    return new RegExp(`\\b${escapeRegex(stem)}(?:e|es|ing)\\b`);
  }
  return new RegExp(`\\b${escapeRegex(term)}s?\\b`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

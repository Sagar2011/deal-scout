import type { Candidate } from "../core/models.js";
import type { CandidateSource } from "../sources/types.js";
import {
  matchesAllTopicTerms,
  topicRelevance,
} from "../sources/topic-match.js";

export async function discoverCandidates(
  topics: string | string[],
  sources: CandidateSource[],
  limit = 11,
  originalTopic = Array.isArray(topics) ? topics[0] : topics
): Promise<Candidate[]> {
  const fetchLimit = Math.max(limit * 5, 50);
  const queries = Array.isArray(topics) ? topics : [topics];
  const candidates = (
    await Promise.all(
      queries.flatMap((topic) =>
        sources.map(async (source) => ({
          topic,
          candidates: await source.findCandidates(topic, fetchLimit),
        }))
      )
    )
  ).flatMap(({ topic, candidates }) =>
    candidates.map((candidate) => ({ candidate, topic }))
  );
  return [
    ...new Map(
      candidates
        .filter(({ candidate, topic }) => {
          const text = `${candidate.name} ${candidate.description}`;
          return (
            topicRelevance(text, originalTopic) > 0 ||
            matchesAllTopicTerms(text, topic)
          );
        })
        .sort(
          (left, right) =>
            rank(right.candidate, originalTopic) -
            rank(left.candidate, originalTopic)
        )
        .map(({ candidate }) => [candidate.sourceUrl, candidate])
    ).values(),
  ].slice(0, limit);
}

function rank(candidate: Candidate, topic: string): number {
  const relevance = topicRelevance(
    `${candidate.name} ${candidate.description}`,
    topic
  );
  return relevance * 1_000_000_000_000 + freshness(candidate);
}

function freshness(candidate: Candidate): number {
  if (candidate.publishedAt) return Date.parse(candidate.publishedAt) || 0;
  const batch = candidate.signal.match(/(Winter|Spring|Summer|Fall) (\d{4})/i);
  if (!batch) return 0;
  const month = { Winter: 0, Spring: 3, Summer: 6, Fall: 9 }[
    `${batch[1][0].toUpperCase()}${batch[1].slice(1).toLowerCase()}` as
      | "Winter"
      | "Spring"
      | "Summer"
      | "Fall"
  ];
  return Date.UTC(Number(batch[2]), month);
}

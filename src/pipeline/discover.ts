import type { Candidate } from "../core/models.js";
import type { CandidateSource } from "../sources/types.js";
import {
  matchesAllTopicTerms,
  matchesStrongExpandedTopic,
  topicRelevance,
} from "../sources/topic-match.js";

export async function discoverCandidates(
  topics: string | string[],
  sources: CandidateSource[],
  limit = 11,
  originalTopic = Array.isArray(topics) ? topics[0] : topics
): Promise<Candidate[]> {
  const candidates = await fetchCandidateMatches(topics, sources, limit);
  return uniqueAndRank(candidates, originalTopic, limit, true);
}

export async function discoverCandidatePool(
  topics: string | string[],
  sources: CandidateSource[],
  limit = 11,
  originalTopic = Array.isArray(topics) ? topics[0] : topics
): Promise<Candidate[]> {
  const candidates = await fetchCandidateMatches(topics, sources, limit);
  return uniqueAndRank(
    candidates,
    originalTopic,
    Math.max(limit * 8, 80),
    false
  );
}

type CandidateMatch = { candidate: Candidate; topic: string };
type DiscoveryJob = { topic: string; source: CandidateSource };

const SOURCE_CONCURRENCY = 2;

async function fetchCandidateMatches(
  topics: string | string[],
  sources: CandidateSource[],
  limit: number
): Promise<CandidateMatch[]> {
  const fetchLimit = Math.max(limit * 5, 50);
  const queries = Array.isArray(topics) ? topics : [topics];
  const jobs: DiscoveryJob[] = queries.flatMap((topic) =>
    sources.map((source) => ({ topic, source }))
  );
  return (
    await mapWithConcurrency(
      jobs,
      SOURCE_CONCURRENCY,
      async ({ topic, source }) => ({
        topic,
        candidates: await source.findCandidates(topic, fetchLimit),
      })
    )
  ).flatMap(({ topic, candidates }) =>
    candidates.map((candidate) => ({ candidate, topic }))
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runWorker)
  );
  return results;
}

function uniqueAndRank(
  candidates: CandidateMatch[],
  originalTopic: string,
  limit: number,
  applyDeterministicFilter: boolean
): Candidate[] {
  return [
    ...new Map(
      candidates
        .filter(
          ({ candidate, topic }) =>
            !applyDeterministicFilter ||
            matchesAllTopicTerms(
              `${candidate.name} ${candidate.description}`,
              originalTopic
            ) ||
            matchesStrongExpandedTopic(
              `${candidate.name} ${candidate.description}`,
              topic
            )
        )
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

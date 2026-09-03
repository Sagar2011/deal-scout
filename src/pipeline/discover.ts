import type { Candidate } from "../core/models.js";
import type { CandidateSource } from "../sources/types.js";
import {
  matchesAllTopicTerms,
  matchesPlannedTopic,
  matchesResearchCriteria,
  topicRelevance,
} from "../sources/topic-match.js";

export async function discoverCandidates(
  topics: string | string[],
  sources: CandidateSource[],
  limit = 11,
  originalTopic = Array.isArray(topics) ? topics[0] : topics,
  inclusionCriteria: string[] = []
): Promise<Candidate[]> {
  const candidates = await fetchCandidateMatches(topics, sources, limit);
  return uniqueAndRank(
    candidates,
    originalTopic,
    limit,
    true,
    normalizeTopics(topics),
    inclusionCriteria
  );
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
    false,
    normalizeTopics(topics)
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
  applyDeterministicFilter: boolean,
  plannedTopics: string[],
  inclusionCriteria: string[] = []
): Candidate[] {
  return [
    ...new Map(
      candidates
        .filter(isCurrentCandidate)
        .filter(
          ({ candidate, topic }) =>
            !applyDeterministicFilter ||
            matchesAllTopicTerms(
              `${candidate.name} ${candidate.description}`,
              originalTopic
            ) ||
            (plannedTopics.some(
              (plannedTopic) =>
                plannedTopic.toLowerCase() !== originalTopic.toLowerCase() &&
                matchesPlannedTopic(
                  `${candidate.name} ${candidate.description}`,
                  plannedTopic
                )
            ) &&
              matchesResearchCriteria(
                `${candidate.name} ${candidate.description}`,
                inclusionCriteria
              ))
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

function normalizeTopics(topics: string | string[]): string[] {
  return Array.isArray(topics) ? topics : [topics];
}

function isCurrentCandidate({ candidate }: CandidateMatch): boolean {
  if (candidate.source !== "Y Combinator") return true;
  const match = candidate.signal.match(
    /(?:Winter|Spring|Summer|Fall)\s+(\d{4})|\b[WSF](\d{2})\b/i
  );
  const rawYear = match?.[1] ?? match?.[2];
  if (!rawYear) return true;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  // YC batch date is the available freshness proxy; it does not prove funding stage.
  return year >= new Date().getUTCFullYear() - 3;
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

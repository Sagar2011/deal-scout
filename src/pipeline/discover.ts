import type { Candidate } from "../core/models.js";
import type { CandidateSource } from "../sources/types.js";

export async function discoverCandidates(
  topic: string,
  sources: CandidateSource[],
  limit = 5
): Promise<Candidate[]> {
  return (
    await Promise.all(
      sources.map((source) => source.findCandidates(topic, limit))
    )
  ).flat();
}

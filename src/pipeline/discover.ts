import axios from "axios";
import type { Candidate } from "../core/models.js";
import { HackerNewsSource } from "../sources/hacker-news.js";
import type { HttpClient } from "../sources/types.js";
import { YcSource } from "../sources/yc.js";

export async function discoverCandidates(
  topic: string,
  http: HttpClient = axios,
  limit = 5
): Promise<Candidate[]> {
  const [ycCandidates, hnCandidates] = await Promise.all([
    new YcSource(http).findCandidates(topic, limit),
    new HackerNewsSource(http).findCandidates(topic, limit),
  ]);

  return [...ycCandidates, ...hnCandidates];
}

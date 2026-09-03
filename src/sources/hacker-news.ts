import type { Candidate } from "../core/models.js";
import type { CandidateSource, HttpClient } from "./types.js";

const SOURCE_TIMEOUT_MS = 15_000;

type HnStory = {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  created_at_i?: number;
};

export class HackerNewsSource implements CandidateSource {
  constructor(private readonly http: HttpClient) {}

  async findCandidates(query: string, limit: number): Promise<Candidate[]> {
    const params = new URLSearchParams({
      query,
      tags: "story",
      hitsPerPage: String(limit),
    });
    const response = await this.http.get<{ hits: HnStory[] }>(
      `https://hn.algolia.com/api/v1/search?${params}`,
      { timeout: SOURCE_TIMEOUT_MS }
    );
    const { hits } = response.data;
    const newestAllowedAge =
      Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365 * 2;
    return hits
      .filter((story) => {
        const title = story.title?.toLowerCase() ?? "";
        return (
          story.url &&
          story.created_at_i &&
          story.created_at_i >= newestAllowedAge &&
          /^show hn:/i.test(title)
        );
      })
      .map((story) => ({
        name: story.title!.replace(/^Show HN:\s*/i, ""),
        website: story.url!,
        description: story.title!,
        source: "Hacker News",
        sourceUrl: `https://news.ycombinator.com/item?id=${story.objectID}`,
        signal: `${story.points ?? 0} HN points`,
        publishedAt: new Date(story.created_at_i! * 1000).toISOString(),
      }));
  }
}

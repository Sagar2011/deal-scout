import type { Candidate } from "../core/models.js";
import type { CandidateSource, HttpClient } from "./types.js";
import { matchesTopic } from "./topic-match.js";

type HnStory = {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  created_at_i?: number;
};

export class HackerNewsSource implements CandidateSource {
  constructor(private readonly http: HttpClient) {}

  async findCandidates(topic: string, limit: number): Promise<Candidate[]> {
    const params = new URLSearchParams({
      query: topic,
      tags: "story",
      hitsPerPage: String(limit),
    });
    const response = await this.http.get<{ hits: HnStory[] }>(
      `https://hn.algolia.com/api/v1/search?${params}`
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
          /^show hn:/i.test(title) &&
          matchesTopic(title, topic)
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

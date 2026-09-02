import type { Candidate } from "../core/models.js";
import type { CandidateSource, HttpClient } from "./types.js";

type HnStory = {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
};

export class HackerNewsSource implements CandidateSource {
  constructor(private readonly http: HttpClient) {}

  async findCandidates(topic: string, limit: number): Promise<Candidate[]> {
    const params = new URLSearchParams({ query: topic, tags: "story", hitsPerPage: String(limit) });
    const response = await this.http.get<{ hits: HnStory[] }>(`https://hn.algolia.com/api/v1/search?${params}`);
    const { hits } = response.data;
    return hits
      .filter((story) => story.title && story.url)
      .map((story) => ({
        name: story.title!.replace(/^Show HN:\s*/i, ""),
        website: story.url!,
        description: story.title!,
        source: "Hacker News",
        sourceUrl: `https://news.ycombinator.com/item?id=${story.objectID}`,
        signal: `${story.points ?? 0} HN points`,
      }));
  }
}

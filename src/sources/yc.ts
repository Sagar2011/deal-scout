import type { Candidate } from "../core/models.js";
import type { CandidateSource, HttpClient } from "./types.js";
import { matchesStrongExpandedTopic } from "./topic-match.js";

const SOURCE_TIMEOUT_MS = 15_000;

type YcCompany = {
  name: string;
  slug: string;
  website?: string;
  one_liner?: string;
  batch?: string;
};

type YcCredentials = {
  app: string;
  key: string;
};

export class YcSource implements CandidateSource {
  constructor(private readonly http: HttpClient) {}

  async findCandidates(topic: string, limit: number): Promise<Candidate[]> {
    const directoryUrl = `https://www.ycombinator.com/companies?query=${encodeURIComponent(
      topic
    )}`;
    const directory = await this.http.get<string>(directoryUrl, {
      timeout: SOURCE_TIMEOUT_MS,
    });
    const credentials = this.extractCredentials(directory.data);
    const response = await this.http.post<{ hits: YcCompany[] }>(
      `https://${credentials.app.toLowerCase()}-dsn.algolia.net/1/indexes/YCCompany_production/query`,
      { query: topic, hitsPerPage: limit, tagFilters: ["ycdc_public"] },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": credentials.app,
          "X-Algolia-API-Key": credentials.key,
        },
        timeout: SOURCE_TIMEOUT_MS,
      }
    );
    const { hits } = response.data;
    return hits
      .filter(
        (company) =>
          company.website &&
          company.one_liner &&
          matchesStrongExpandedTopic(
            `${company.name} ${company.one_liner}`,
            topic
          )
      )
      .slice(0, limit)
      .map((company) => ({
        name: company.name,
        website: company.website!,
        description: company.one_liner!,
        source: "Y Combinator",
        sourceUrl: `https://www.ycombinator.com/companies/${company.slug}`,
        signal: `YC ${company.batch ?? "directory"} company listing`,
      }));
  }

  private extractCredentials(html: string): YcCredentials {
    const match = html.match(/window\.AlgoliaOpts\s*=\s*({.*?});/);
    if (!match)
      throw new Error("YC directory did not provide search credentials");
    return JSON.parse(match[1]) as YcCredentials;
  }
}

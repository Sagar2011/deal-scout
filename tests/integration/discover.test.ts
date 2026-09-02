import assert from "node:assert/strict";
import test from "node:test";

import { discoverCandidates } from "../../src/pipeline/discover.js";
import { HackerNewsSource } from "../../src/sources/hacker-news.js";
import type { CandidateSource } from "../../src/sources/types.js";
import { YcSource } from "../../src/sources/yc.js";

test("returns one candidate from YC and Hacker News", async () => {
  const requests: string[] = [];
  const http = {
    async get(url: string) {
      requests.push(url);

      if (url.startsWith("https://www.ycombinator.com/companies")) {
        return {
          data: '<script>window.AlgoliaOpts = {"app":"APP123","key":"public-key"};</script>',
        };
      }

      if (url.startsWith("https://hn.algolia.com/api/v1/search")) {
        return {
          data: {
            hits: [
              {
                objectID: "42",
                title: "Show HN: HN Agent",
                url: "https://hn-agent.example",
                points: 120,
                created_at_i: Math.floor(Date.now() / 1000),
              },
              {
                objectID: "43",
                title: "Airy Labs and Ed-Tech Startup Failures",
                url: "https://hackeducation.example/airy",
                points: 11,
                created_at_i: 1328990400,
              },
            ],
          },
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    async post(url: string) {
      requests.push(url);
      if (url.startsWith("https://app123-dsn.algolia.net")) {
        return {
          data: {
            hits: [
              {
                name: "YC Agent",
                slug: "yc-agent",
                website: "https://yc-agent.example",
                one_liner: "AI agents for small businesses.",
                batch: "W25",
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  };

  const candidates = await discoverCandidates(
    "AI agents",
    [new YcSource(http), new HackerNewsSource(http)],
    1
  );

  assert.deepEqual(candidates, [
    {
      name: "YC Agent",
      website: "https://yc-agent.example",
      description: "AI agents for small businesses.",
      source: "Y Combinator",
      sourceUrl: "https://www.ycombinator.com/companies/yc-agent",
      signal: "YC W25 company listing",
    },
    {
      name: "HN Agent",
      website: "https://hn-agent.example",
      description: "Show HN: HN Agent",
      source: "Hacker News",
      sourceUrl: "https://news.ycombinator.com/item?id=42",
      signal: "120 HN points",
    },
  ]);
  assert.equal(requests.length, 3);
});

test("discovers from a supplied source registry", async () => {
  const source: CandidateSource = {
    async findCandidates() {
      return [
        {
          name: "Extensible Source",
          website: "https://example.com",
          description: "A registered source candidate.",
          source: "Hacker News",
          sourceUrl: "https://news.ycombinator.com/item?id=1",
          signal: "1 HN point",
        },
      ];
    },
  };
  assert.equal(
    (await discoverCandidates("anything", [source], 5))[0].name,
    "Extensible Source"
  );
});

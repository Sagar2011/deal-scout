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

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "HN Agent");
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
    (await discoverCandidates("registered source", [source], 5))[0].name,
    "Extensible Source"
  );
});

test("filters loose YC matches using meaningful topic terms", async () => {
  const source = new YcSource({
    async get() {
      return {
        data: '<script>window.AlgoliaOpts = {"app":"APP123","key":"public-key"};</script>',
      };
    },
    async post() {
      return {
        data: {
          hits: [
            {
              name: "GiveAway",
              slug: "giveaway",
              website: "https://giveaway.example",
              one_liner: "Community driven marketplace for used things.",
            },
            {
              name: "Nitrode",
              slug: "nitrode",
              website: "https://nitrode.example",
              one_liner: "Frontier AI research to advance game development.",
            },
            {
              name: "Fello",
              slug: "fello",
              website: "https://fello.example",
              one_liner: "Save money and play games every week.",
            },
          ],
        },
      };
    },
  });

  const candidates = await source.findCandidates("gaming startup", 2);

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["Nitrode", "Fello"]
  );
});

test("returns the freshest relevant candidates up to the final requested limit", async () => {
  const source: CandidateSource = {
    async findCandidates() {
      return [
        {
          name: "Older game studio",
          website: "https://older.example",
          description: "Tools for game development.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/older",
          signal: "YC Winter 2022 company listing",
        },
        {
          name: "Newer game studio",
          website: "https://newer.example",
          description: "Tools for game development.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/newer",
          signal: "YC Winter 2025 company listing",
        },
        {
          name: "Game agent",
          website: "https://agent.example",
          description: "AI agents for game development.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/agent",
          signal: "YC Winter 2024 company listing",
        },
      ];
    },
  };

  const candidates = await discoverCandidates("gaming AI startup", [source], 2);

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["Game agent", "Newer game studio"]
  );
});

test("does not admit a candidate that matches only a broadened query", async () => {
  const source: CandidateSource = {
    async findCandidates(topic) {
      if (topic === "video game tools") {
        return [
          {
            name: "Video processing API",
            website: "https://video.example",
            description: "APIs for compressing video files.",
            source: "Hacker News",
            sourceUrl: "https://news.ycombinator.com/item?id=video",
            signal: "10 HN points",
          },
        ];
      }
      return [
        {
          name: "Game creation toolkit",
          website: "https://games.example",
          description: "Development tools for game studios.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/games",
          signal: "YC Winter 2025 company listing",
        },
      ];
    },
  };

  const candidates = await discoverCandidates(
    ["gaming startup", "video game tools"],
    [source],
    11,
    "gaming startup"
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["Game creation toolkit"]
  );
});

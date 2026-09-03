import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverCandidatePool,
  discoverCandidates,
} from "../../src/pipeline/discover.js";
import { HackerNewsSource } from "../../src/sources/hacker-news.js";
import { matchesStrongExpandedTopic } from "../../src/sources/topic-match.js";
import type { CandidateSource } from "../../src/sources/types.js";
import { YcSource } from "../../src/sources/yc.js";

test("returns one candidate from YC and Hacker News", async () => {
  const requests: Array<{ url: string; config?: unknown }> = [];
  const http = {
    async get(url: string, config?: unknown) {
      requests.push({ url, config });

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
                title: "Show HN: AI Agent",
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
    async post(url: string, _body?: unknown, config?: unknown) {
      requests.push({ url, config });
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
  assert.equal(candidates[0].name, "AI Agent");
  assert.equal(requests.length, 3);
  assert.deepEqual(
    requests.map((request) => request.config),
    [
      { timeout: 15_000 },
      { timeout: 15_000 },
      {
        timeout: 15_000,
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": "APP123",
          "X-Algolia-API-Key": "public-key",
        },
      },
    ]
  );
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

test("limits concurrent public-source requests", async () => {
  let active = 0;
  let maxActive = 0;
  const source: CandidateSource = {
    async findCandidates(topic) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return [
        {
          name: topic,
          website: "https://example.com",
          description: topic,
          source: "Y Combinator",
          sourceUrl: `https://example.com/${topic}`,
          signal: "YC W25 company listing",
        },
      ];
    },
  };

  await discoverCandidatePool(
    ["fintech", "payments", "lending", "banking", "insurance"],
    [source],
    11,
    "fintech startups"
  );

  assert.equal(maxActive, 2);
});

test("excludes stale YC companies from the candidate pool", async () => {
  const source: CandidateSource = {
    async findCandidates() {
      return [
        {
          name: "Current Fintech",
          website: "https://current.example",
          description: "Digital expense management for businesses.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/current-fintech",
          signal: "YC Winter 2025 company listing",
        },
        {
          name: "Stale Fintech",
          website: "https://stale.example",
          description: "Digital expense management for businesses.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/stale-fintech",
          signal: "YC Winter 2014 company listing",
        },
      ];
    },
  };

  const candidates = await discoverCandidatePool("fintech", [source], 11);

  assert.deepEqual(candidates.map((candidate) => candidate.name), [
    "Current Fintech",
  ]);
});

test("keeps YC search hits for later topic selection", async () => {
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
    ["GiveAway", "Nitrode"]
  );
});

test("matches a startup to the domain anchor of a generated query", () => {
  assert.equal(
    matchesStrongExpandedTopic(
      "Stablecoin API for global payments",
      "automated digital payment processing platform"
    ),
    true
  );
});

test("returns only candidates that satisfy every original-topic constraint", async () => {
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
    ["Game agent"]
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

test("requires a contextual match from an expanded query", async () => {
  const source: CandidateSource = {
    async findCandidates() {
      return [
        {
          name: "Coding Agent",
          website: "https://coding.example",
          description: "AI agents for software development.",
          source: "Hacker News",
          sourceUrl: "https://news.ycombinator.com/item?id=coding",
          signal: "100 HN points",
        },
        {
          name: "Business Messaging Agent",
          website: "https://messaging.example",
          description: "AI agents for business messaging.",
          source: "Hacker News",
          sourceUrl: "https://news.ycombinator.com/item?id=messaging",
          signal: "20 HN points",
        },
        {
          name: "Invoice Agent",
          website: "https://invoices.example",
          description:
            "AI agents automate invoice follow-up for small businesses.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/invoice-agent",
          signal: "YC Winter 2025 company listing",
        },
      ];
    },
  };

  const candidates = await discoverCandidates(
    ["AI agents for SMBs", "small business AI agents"],
    [source],
    11,
    "AI agents for SMBs"
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["Invoice Agent"]
  );
});

test("requires the complete thesis match instead of a generic AI-agent term", async () => {
  const source: CandidateSource = {
    async findCandidates() {
      return [
        {
          name: "Coding Agent",
          website: "https://coding.example",
          description: "AI agents for software development.",
          source: "Hacker News",
          sourceUrl: "https://news.ycombinator.com/item?id=coding",
          signal: "100 HN points",
        },
        {
          name: "Invoice Agent",
          website: "https://invoices.example",
          description:
            "AI agents automate invoice follow-up for small businesses.",
          source: "Y Combinator",
          sourceUrl: "https://www.ycombinator.com/companies/invoice-agent",
          signal: "YC Winter 2025 company listing",
        },
      ];
    },
  };

  const candidates = await discoverCandidates(
    ["AI agents for SMBs", "small business AI agents"],
    [source],
    11,
    "AI agents for SMBs"
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["Invoice Agent"]
  );
});

test("keeps recent Show HN product launches for later topic selection", async () => {
  const source = new HackerNewsSource({
    async get() {
      return {
        data: {
          hits: [
            {
              objectID: "launch",
              title: "Show HN: AI agents for small businesses",
              url: "https://launch.example",
              points: 20,
              created_at_i: Math.floor(Date.now() / 1000),
            },
            {
              objectID: "article",
              title: "How AI agents affect small businesses",
              url: "https://article.example",
              points: 20,
              created_at_i: Math.floor(Date.now() / 1000),
            },
            {
              objectID: "generic-ai",
              title: "Show HN: AI image generator",
              url: "https://image.example",
              points: 20,
              created_at_i: Math.floor(Date.now() / 1000),
            },
          ],
        },
      };
    },
    async post() {
      throw new Error("not used");
    },
  });

  assert.deepEqual(
    (await source.findCandidates("AI agents for small businesses", 5)).map(
      (candidate) => candidate.name
    ),
    ["AI agents for small businesses", "AI image generator"]
  );
});

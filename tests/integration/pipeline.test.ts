import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderMemo, renderRunReport } from "../../src/reports/memo.js";
import { runPipeline } from "../../src/pipeline/run.js";
import { analyseCandidate } from "../../src/analysis/analysis.js";
import { OpenRouterAnalyzer } from "../../src/analysis/llm.js";
import { OpenRouterQueryExpander } from "../../src/analysis/query-expander.js";
import { recommend } from "../../src/analysis/recommendation.js";
import { scoreAnalysis } from "../../src/analysis/scoring.js";
import { fileRunStore } from "../../src/core/storage.js";
import type { PipelineDependencies } from "../../src/core/contracts.js";
import type {
  Candidate,
  CandidateProfile,
  Evidence,
  StartupAnalysis,
} from "../../src/core/models.js";

const candidate: Candidate = {
  name: "Acme Agent",
  website: "https://acme.example",
  description: "AI agents automate invoice follow-up for small businesses.",
  source: "Y Combinator",
  sourceUrl: "https://www.ycombinator.com/companies/acme-agent",
  signal: "YC W25 company listing",
};

const analysis: StartupAnalysis = {
  team: "Founder background is not available from the source data.",
  product: "Automates invoice follow-up for small businesses.",
  market: "SMB finance workflow automation is the initial wedge.",
  traction: "YC W25 company listing.",
  risks: ["Founder background is unverified."],
  openQuestions: ["What is the customer retention profile?"],
  criteria: {
    workflowClarity: 0.9,
    smbFit: 0.9,
    technicalDepth: 0.4,
    signalStrength: 0.6,
    whyNow: 0.8,
  },
};

const profile: CandidateProfile = {
  profileUrl: candidate.sourceUrl,
  description: candidate.description,
  logoUrl: "https://images.example/acme-logo.png",
  founders: [
    {
      name: "Ada Lovelace",
      title: "Founder/CEO",
      bio: "Former engineering lead.",
      linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
    },
  ],
};

test("scores and recommends a sufficiently evidenced thesis match", () => {
  const score = scoreAnalysis(analysis);
  assert.equal(score.total, 73);
  assert.deepEqual(score.breakdown[0], {
    label: "Workflow clarity",
    score: 23,
    maximum: 25,
  });
  assert.equal(
    recommend(score, [
      {
        claim: "YC listing",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
    ]).decision,
    "Watch"
  );
});

test("calibrates materially different LLM criteria to the same evidence-backed score", () => {
  const evidence: Evidence[] = [
    {
      claim: candidate.description,
      url: candidate.sourceUrl,
      source: candidate.source,
      capturedAt: "2026-09-02T00:00:00.000Z",
    },
    {
      claim: "Ada Lovelace, Founder/CEO: Former engineering lead.",
      url: candidate.sourceUrl,
      source: "Y Combinator",
      capturedAt: "2026-09-02T00:00:00.000Z",
    },
  ];
  const lowLlmScore = scoreAnalysis(
    {
      ...analysis,
      criteria: {
        workflowClarity: 0.1,
        smbFit: 0.1,
        technicalDepth: 0.1,
        signalStrength: 0.1,
        whyNow: 0.1,
      },
    },
    { candidate, evidence, profile }
  );
  const highLlmScore = scoreAnalysis(
    {
      ...analysis,
      criteria: {
        workflowClarity: 1,
        smbFit: 1,
        technicalDepth: 1,
        signalStrength: 1,
        whyNow: 1,
      },
    },
    { candidate, evidence, profile }
  );
  assert.deepEqual(lowLlmScore, highLlmScore);
});

test("passes a vague fallback candidate with no explicit SMB fit", async () => {
  const fallback = await analyseCandidate(
    {
      ...candidate,
      name: "Vague Agent",
      description: "Agentic AI for society builders.",
      signal: "YC Fall 2025 company listing",
    },
    []
  );
  assert.equal(scoreAnalysis(fallback).total, 46);
  assert.equal(recommend(scoreAnalysis(fallback), []).decision, "Pass");
});

test("accepts a structured LLM analysis", async () => {
  const analyzer = new OpenRouterAnalyzer("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return {
        data: { choices: [{ message: { content: JSON.stringify(analysis) } }] },
      };
    },
  });
  assert.deepEqual(await analyzer.analyse(candidate, []), analysis);
});

test("uses OpenRouter to return unique expanded search queries", async () => {
  const expander = new OpenRouterQueryExpander("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  queries: ["digital health", "health AI", "digital health"],
                }),
              },
            },
          ],
        },
      };
    },
  });

  assert.deepEqual(await expander.expand("healthcare startup"), [
    "digital health",
    "health AI",
  ]);
});

test("rejects ecosystem queries from an LLM source plan", async () => {
  const expander = new OpenRouterQueryExpander("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  queries: [
                    "game development tools",
                    "gaming venture capital firms",
                    "indie game funding opportunities",
                    "video game accelerator programs",
                  ],
                }),
              },
            },
          ],
        },
      };
    },
  });

  assert.deepEqual(await expander.expand("gaming startup"), [
    "game development tools",
  ]);
});

test("normalizes nested LLM fields before HTML rendering", async () => {
  const analyzer = new OpenRouterAnalyzer("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...analysis,
                  team: { founders: ["Ada Lovelace", "Grace Hopper"], size: 2 },
                  product: { description: "Automates finance work." },
                  market: { segment: "SMB finance" },
                  traction: { customers: "unknown", team: 2 },
                }),
              },
            },
          ],
        },
      };
    },
  });
  const result = await analyzer.analyse(candidate, []);
  assert.match(result.team, /founders: Ada Lovelace; Grace Hopper/);
  assert.equal(result.product, "description: Automates finance work.");
  assert.equal(result.market, "segment: SMB finance");
  assert.match(result.traction, /team: 2/);
});

test("renders cited HTML with a clear call", () => {
  const memo = renderMemo({
    candidate,
    evidence: [
      {
        claim: candidate.description,
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
    analysis,
    score: scoreAnalysis(analysis),
    profile,
    recommendation: {
      decision: "Watch",
      rationale: "Promising workflow fit.",
      mindChanges: ["Verify retention.", "Verify team depth."],
    },
  });
  assert.match(memo, /INVESTMENT TAKEAWAY/);
  assert.match(memo, /Score breakdown/);
  assert.match(memo, /23 \/ 25/);
  assert.match(memo, /class="decision-pill watch"/);
  assert.match(memo, /Source: Y Combinator/);
  assert.match(memo, /Evidence: 1/);
  assert.match(memo, /class="meter strong"/);
  assert.match(memo, /class="meter mixed"/);
  assert.match(memo, /class="meter weak"/);
  assert.match(memo, /Thesis drivers/);
  assert.match(memo, /src="https:\/\/images\.example\/acme-logo\.png"/);
  assert.match(memo, /Ada Lovelace on LinkedIn/);
  assert.match(memo, /href="https:\/\/www\.ycombinator\.com/);
});

test("renders optional logos and founder links in run cards", () => {
  const report = renderRunReport("AI agents", [
    {
      candidate,
      evidence: [],
      analysis,
      score: scoreAnalysis(analysis),
      recommendation: {
        decision: "Watch",
        rationale: "Promising workflow fit.",
        mindChanges: [],
      },
      profile,
    },
  ]);
  assert.match(report, /src="https:\/\/images\.example\/acme-logo\.png"/);
  assert.match(report, /Ada Lovelace on LinkedIn/);
});

test("writes evidence, analysis, and a memo for one candidate", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  const info: string[] = [];
  try {
    const summary = await runPipeline({
      topic: "AI agents for SMBs",
      rootDir,
      candidates: [candidate],
      logger: { info: (message) => info.push(message), error: () => undefined },
    });
    assert.equal(summary.completed, 1);
    assert.ok(info.some((message) => message.includes("Starting run")));
    assert.ok(
      info.some((message) => message.includes("deterministic analysis"))
    );
    assert.ok(info.some((message) => message.includes("rendering HTML memo")));
    const memo = await readFile(
      join(summary.runPath, "memos", "acme-agent.html"),
      "utf8"
    );
    assert.match(memo, /<title>Acme Agent/);
    assert.match(memo, /INVESTMENT SNAPSHOT/);
    assert.ok(await readFile(join(summary.runPath, "report.html"), "utf8"));
    assert.ok(
      await readFile(
        join(summary.runPath, "evidence", "acme-agent.json"),
        "utf8"
      )
    );
    assert.ok(
      await readFile(
        join(summary.runPath, "analysis", "acme-agent.json"),
        "utf8"
      )
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("saves the literal and expanded search queries for a pipeline run", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  const queries: string[] = [];
  const dependencies: PipelineDependencies = {
    sources: [
      {
        async findCandidates(topic) {
          queries.push(topic);
          return topic === "digital health"
            ? [
                {
                  ...candidate,
                  name: "Digital Health Workflow",
                  description: "Digital health workflow automation.",
                  sourceUrl:
                    "https://www.ycombinator.com/companies/digital-health-workflow",
                },
              ]
            : [];
        },
      },
    ],
    enrichers: [],
    queryExpander: {
      name: "OpenRouter query planner",
      async expand() {
        return ["digital health"];
      },
    },
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
  try {
    const summary = await runPipeline({
      topic: "healthcare startup",
      rootDir,
      limit: 1,
      dependencies,
      logger: { info: () => undefined, error: () => undefined },
    });
    assert.equal(summary.completed, 1);
    assert.deepEqual(queries, ["healthcare startup", "digital health"]);
    assert.deepEqual(
      JSON.parse(
        await readFile(join(summary.runPath, "query-plan.json"), "utf8")
      ),
      {
        topic: "healthcare startup",
        queries: ["healthcare startup", "digital health"],
        provider: "OpenRouter query planner",
      }
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("retries bounded discovery to meet the requested candidate count", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  const expansionCalls: string[][] = [];
  const queries: string[] = [];
  const dependencies: PipelineDependencies = {
    sources: [
      {
        async findCandidates(topic) {
          queries.push(topic);
          if (topic === "digital health") {
            return [
              {
                ...candidate,
                name: "Digital Health Workflow",
                description: "Digital health workflow automation.",
                sourceUrl:
                  "https://www.ycombinator.com/companies/digital-health-workflow",
              },
            ];
          }
          if (topic === "care delivery software") {
            return [
              {
                ...candidate,
                name: "Care Delivery Software",
                description: "Care delivery software for clinics.",
                sourceUrl:
                  "https://www.ycombinator.com/companies/care-delivery-software",
              },
            ];
          }
          return [];
        },
      },
    ],
    enrichers: [],
    queryExpander: {
      name: "OpenRouter query planner",
      async expand(_topic, excludedQueries = []) {
        expansionCalls.push(excludedQueries);
        return excludedQueries.length
          ? ["care delivery software"]
          : ["digital health"];
      },
    },
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
  try {
    const summary = await runPipeline({
      topic: "healthcare startup",
      rootDir,
      limit: 2,
      dependencies,
      logger: { info: () => undefined, error: () => undefined },
    });
    assert.equal(summary.completed, 2);
    assert.deepEqual(expansionCalls, [
      [],
      ["healthcare startup", "digital health"],
    ]);
    assert.deepEqual(queries, [
      "healthcare startup",
      "digital health",
      "healthcare startup",
      "digital health",
      "care delivery software",
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("logs a shortfall and completes with the relevant candidates found", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  const errors: string[] = [];
  const dependencies: PipelineDependencies = {
    sources: [
      {
        async findCandidates() {
          return [];
        },
      },
    ],
    enrichers: [],
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
  try {
    const summary = await runPipeline({
      topic: "very narrow category",
      rootDir,
      limit: 2,
      dependencies,
      logger: {
        info: () => undefined,
        error: (message) => errors.push(message),
      },
    });
    assert.equal(summary.completed, 0);
    assert.ok(
      errors.some((message) =>
        message.includes("Found 0/2 relevant candidates")
      )
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("processes candidate work with the configured concurrency limit", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  let active = 0;
  let maxActive = 0;
  const dependencies: PipelineDependencies = {
    sources: [],
    enrichers: [],
    analyzer: {
      name: "Delayed analyzer",
      async analyse() {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return analysis;
      },
    },
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
  try {
    const summary = await runPipeline({
      topic: "AI agents for SMBs",
      rootDir,
      candidates: [
        candidate,
        {
          ...candidate,
          name: "Second Agent",
          sourceUrl: "https://example.com/2",
        },
        {
          ...candidate,
          name: "Third Agent",
          sourceUrl: "https://example.com/3",
        },
      ],
      concurrency: 2,
      dependencies,
      logger: { info: () => undefined, error: () => undefined },
    });
    assert.equal(summary.completed, 3);
    assert.equal(maxActive, 2);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

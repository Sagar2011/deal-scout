import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderMemo } from "../../src/reports/memo.js";
import { runPipeline } from "../../src/pipeline/run.js";
import { analyseCandidate } from "../../src/analysis/analysis.js";
import { OpenRouterAnalyzer } from "../../src/analysis/llm.js";
import { recommend } from "../../src/analysis/recommendation.js";
import { scoreAnalysis } from "../../src/analysis/scoring.js";
import type { Candidate, StartupAnalysis } from "../../src/core/models.js";

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

test("scores and recommends a sufficiently evidenced thesis match", () => {
  const score = scoreAnalysis(analysis);
  assert.equal(score.total, 73);
  assert.deepEqual(score.breakdown[0], { label: "Workflow clarity", score: 23, maximum: 25 });
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

test("normalizes nested LLM fields before HTML rendering", async () => {
  const analyzer = new OpenRouterAnalyzer("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return {
        data: {
          choices: [{ message: { content: JSON.stringify({
            ...analysis,
            team: { founders: ["Ada Lovelace", "Grace Hopper"], size: 2 },
            product: { description: "Automates finance work." },
            market: { segment: "SMB finance" },
            traction: { customers: "unknown", team: 2 },
          }) } }],
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
  assert.match(memo, /href="https:\/\/www\.ycombinator\.com/);
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

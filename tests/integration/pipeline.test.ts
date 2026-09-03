import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderMemo, renderRunReport } from "../../src/reports/memo.js";
import { runPipeline } from "../../src/pipeline/run.js";
import { analyseCandidate } from "../../src/analysis/analysis.js";
import { OpenRouterAnalyzer } from "../../src/analysis/llm.js";
import { recommend } from "../../src/analysis/recommendation.js";
import { scoreAnalysis } from "../../src/analysis/scoring.js";
import { collectCompanyWebsiteEvidence } from "../../src/research/company-website.js";
import { createRunThesis } from "../../src/core/thesis.js";
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
    topicFit: 0.9,
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
  const recommendation = recommend(
    score,
    [
      {
        claim: "YC listing",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
      {
        claim: "Founder profile",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
      {
        claim: "Customer workflow evidence",
        url: candidate.website,
        source: "Company website",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
      {
        claim: "Product evidence",
        url: candidate.website,
        source: "Company website",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
    createRunThesis("AI agents for SMBs"),
    { candidate, profile }
  );
  assert.equal(recommendation.decision, "Watch");
  assert.match(recommendation.rationale, /Acme Agent/);
  assert.match(recommendation.rationale, /workflow/i);
  assert.match(recommendation.mindChanges[0] ?? "", /Acme Agent/);
});

test("does not upgrade a recommendation from duplicate evidence records", () => {
  const score = scoreAnalysis(analysis);
  const recommendation = recommend(
    score,
    Array.from({ length: 4 }, () => ({
      claim: "Repeated YC profile claim",
      url: candidate.sourceUrl,
      source: "YC company profile",
      capturedAt: "2026-09-03T00:00:00.000Z",
    })),
    createRunThesis("AI agents for SMBs"),
    { candidate, profile }
  );

  assert.equal(recommendation.decision, "Pass");
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
        topicFit: 0.1,
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
        topicFit: 1,
        technicalDepth: 1,
        signalStrength: 1,
        whyNow: 1,
      },
    },
    { candidate, evidence, profile }
  );
  assert.deepEqual(lowLlmScore, highLlmScore);
});

test("varies calibrated scores when public evidence differs", () => {
  const richerProfile: CandidateProfile = {
    ...profile,
    teamSize: 12,
    founders: [
      ...profile.founders,
      {
        name: "Grace Hopper",
        title: "Co-founder/CTO",
        bio: "Computer science researcher and engineering leader.",
      },
    ],
  };
  const richer = scoreAnalysis(analysis, {
    candidate: {
      ...candidate,
      signal: "YC Summer 2026 company listing",
    },
    evidence: [
      {
        claim: "AI agents automate invoice follow-up and billing workflows.",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
      {
        claim: "Customers use the product for clinic operations.",
        url: candidate.website,
        source: "Company website",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
    ],
    profile: richerProfile,
    thesis: createRunThesis("AI agents for SMBs"),
  });
  const weaker = scoreAnalysis(analysis, {
    candidate: {
      ...candidate,
      description: "Business software.",
      signal: "YC Winter 2024 company listing",
    },
    evidence: [
      {
        claim: "Business software.",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
    ],
    thesis: createRunThesis("AI agents for SMBs"),
  });

  assert.ok(richer.total > weaker.total);
  assert.notDeepEqual(richer.breakdown, weaker.breakdown);
  assert.equal(richer.breakdown[0]?.score, 25);
  assert.equal(richer.breakdown[2]?.score, 12);
});

test("caps agent-fit scoring when the company website contradicts an uncorroborated agent claim", () => {
  const score = scoreAnalysis(analysis, {
    candidate: {
      ...candidate,
      description: "AI agents for dental operations.",
    },
    evidence: [
      {
        claim: "AI agents for dental operations.",
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
      {
        claim:
          "AI-powered clinical documentation platform for dental practices.",
        url: candidate.website,
        source: "Company website",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
    ],
    thesis: createRunThesis("AI agents for healthcare operations"),
  });

  assert.deepEqual(score.breakdown.slice(0, 2), [
    { label: "Workflow clarity", score: 15, maximum: 25 },
    {
      label: "AI Agents For Healthcare Operations fit",
      score: 12,
      maximum: 20,
    },
  ]);
});

test("gives zero points to dimensions without supporting evidence", () => {
  const score = scoreAnalysis(analysis, {
    candidate: {
      ...candidate,
      name: "Unknown Product",
      description: "A new product.",
      signal: "YC Winter 2025 company listing",
    },
    evidence: [],
  });

  assert.equal(score.total, 0);
  assert.deepEqual(
    score.breakdown.map((item) => item.score),
    [0, 0, 0, 0, 0]
  );
});

test("does not score why-now without a dedicated market-timing source", () => {
  const score = scoreAnalysis(analysis, {
    candidate,
    evidence: [
      {
        claim: candidate.description,
        url: candidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
      {
        claim: "Newly released AI capability for small businesses.",
        url: candidate.website,
        source: "Company website",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
  });

  assert.equal(
    score.breakdown.find((item) => item.label === "Why now")?.score,
    0
  );
});

test("scores a candidate against the supplied topic instead of SMB fit", () => {
  const healthcareCandidate: Candidate = {
    ...candidate,
    name: "Health Acme",
    description: "Healthcare credentialing software for provider operations.",
  };
  const score = scoreAnalysis(analysis, {
    candidate: healthcareCandidate,
    evidence: [
      {
        claim: healthcareCandidate.description,
        url: healthcareCandidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
    thesis: createRunThesis("healthcare startup"),
  });

  assert.deepEqual(score.breakdown[1], {
    label: "Healthcare Startup fit",
    score: 20,
    maximum: 20,
  });
});

test("scores thesis fit from a generated research query", () => {
  const expenseCandidate: Candidate = {
    ...candidate,
    name: "Expense Acme",
    description: "Expense management for growing businesses.",
  };
  const score = scoreAnalysis(analysis, {
    candidate: expenseCandidate,
    evidence: [
      {
        claim: expenseCandidate.description,
        url: expenseCandidate.sourceUrl,
        source: "Y Combinator",
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
    ],
    thesis: createRunThesis({
      topic: "fintech startups",
      thesis: "Fintech startups modernize financial services.",
      targetCustomer: "Consumers and businesses",
      inclusionCriteria: ["Financial-service technology"],
      exclusions: [],
      queries: ["real-time expense management", "cross-border payments"],
    }),
  });

  assert.deepEqual(score.breakdown[1], {
    label: "Fintech Startups fit",
    score: 10,
    maximum: 20,
  });
});

test("captures a public company website description as evidence", async () => {
  const evidence = await collectCompanyWebsiteEvidence(candidate, {
    async post() {
      throw new Error("not used");
    },
    async get() {
      return {
        data: '<meta property="og:description" content="Automates invoice follow-up for small businesses.">',
      };
    },
  });

  assert.equal(evidence[0]?.source, "Company website");
  assert.match(evidence[0]?.claim ?? "", /Automates invoice follow-up/);
});

test("passes a vague deterministic fallback candidate", async () => {
  const fallback = await analyseCandidate(
    {
      ...candidate,
      name: "Vague Agent",
      description: "Agentic AI for society builders.",
      signal: "YC Fall 2025 company listing",
    },
    []
  );
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

test("saves the LLM research brief and uses its source queries", async () => {
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
    researchPlanner: {
      name: "OpenRouter research planner",
      async plan(topic) {
        return {
          topic,
          thesis: "Digital-health workflow software for care teams.",
          targetCustomer: "Care teams",
          inclusionCriteria: ["Digital-health workflow", "Care delivery user"],
          exclusions: ["Generic healthcare news"],
          queries: ["digital health"],
        };
      },
    },
    candidateSelector: {
      name: "OpenRouter candidate selector",
      async select(_brief, candidates) {
        return { candidates, reasons: [] };
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
        provider: "OpenRouter research planner",
      }
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(join(summary.runPath, "research-brief.json"), "utf8")
      ),
      {
        topic: "healthcare startup",
        thesis: "Digital-health workflow software for care teams.",
        targetCustomer: "Care teams",
        inclusionCriteria: ["Digital-health workflow", "Care delivery user"],
        exclusions: ["Generic healthcare news"],
        queries: ["healthcare startup", "digital health"],
      }
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("runs every planned source query once without a second LLM planning call", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  let planningCalls = 0;
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
          return [];
        },
      },
    ],
    enrichers: [],
    researchPlanner: {
      name: "OpenRouter research planner",
      async plan(topic) {
        planningCalls += 1;
        return {
          topic,
          thesis: "Digital-health workflow software.",
          targetCustomer: "Care teams",
          inclusionCriteria: ["Digital health", "Workflow software"],
          exclusions: [],
          queries: ["digital health"],
        };
      },
    },
    candidateSelector: {
      name: "OpenRouter candidate selector",
      async select(_brief, candidates) {
        return { candidates, reasons: [] };
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
    assert.equal(summary.completed, 1);
    assert.equal(planningCalls, 1);
    assert.deepEqual(queries, ["healthcare startup", "digital health"]);
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
    researchPlanner: {
      name: "Research planner",
      async plan(topic) {
        return {
          topic,
          thesis: "A narrow test thesis.",
          targetCustomer: "Test customer",
          inclusionCriteria: [],
          exclusions: [],
          queries: [topic],
        };
      },
    },
    candidateSelector: {
      name: "Candidate selector",
      async select(_brief, candidates) {
        return { candidates, reasons: [] };
      },
    },
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

test("fails a live run when the candidate selector fails", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  const dependencies: PipelineDependencies = {
    sources: [
      {
        async findCandidates() {
          return [candidate];
        },
      },
    ],
    enrichers: [],
    researchPlanner: {
      name: "Available planner",
      async plan(topic) {
        return {
          topic,
          thesis: "Test thesis.",
          targetCustomer: "Test customer",
          inclusionCriteria: [],
          exclusions: [],
          queries: [topic],
        };
      },
    },
    candidateSelector: {
      name: "Unavailable selector",
      async select() {
        throw new Error("rate limited");
      },
    },
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
  try {
    await assert.rejects(
      runPipeline({
        topic: "AI agents for SMBs",
        rootDir,
        limit: 1,
        dependencies,
        logger: { info: () => undefined, error: () => undefined },
      }),
      /Candidate selection failed: rate limited/
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("fails a live run when the research planner is unavailable", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "deal-scout-"));
  try {
    await assert.rejects(
      runPipeline({
        topic: "AI agents for SMBs",
        rootDir,
        dependencies: {
          sources: [],
          enrichers: [],
          renderer: { renderMemo, renderRunReport },
          store: fileRunStore,
        },
        logger: { info: () => undefined, error: () => undefined },
      }),
      /Live discovery requires an LLM research planner/
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

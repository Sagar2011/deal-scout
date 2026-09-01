# DealScout Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lean Node.js, TypeScript, and Volta CLI foundation for DealScout that can run a traceable investment-triage pipeline and document its AI-assisted development process.

**Architecture:** A small command handler creates a file-backed run and delegates to focused modules for configuration, candidate sources, evidence, analysis, scoring, recommendations, and Markdown memo rendering. Modules communicate through explicit domain types; the first runnable implementation uses deterministic fixtures and adapters so the orchestration and output format work before live source or LLM credentials are introduced.

**Tech Stack:** Node.js 20.10.0, npm 10.2.3, TypeScript 5, tsx, Node built-in test runner, Volta, plain Markdown/JSON artifacts.

**Spec:** `docs/superpowers/specs/2026-09-01-deal-scout-design.md`

## Global Constraints

- Pin Node.js `20.10.0` and npm `10.2.3` with Volta.
- Keep dependencies limited to TypeScript, tsx, and `@types/node` for the scaffold.
- Use the CLI command `deal-scout run --topic <topic>`; no frontend, database, queue, vector database, or account system.
- Store every run under `runs/<run-id>/` with input, candidates, evidence, analysis, and Markdown memos.
- Mark missing evidence as an open question; never manufacture a claim or citation.
- Test deterministic modules with Node's built-in test runner and fixtures; do not make test network calls.
- Commit sample outputs and concise documentation, including an honest AI workflow trail.

---

## Planned File Structure

- `package.json`: Volta pin, scripts, package metadata, and development dependencies.
- `tsconfig.json`: strict TypeScript compilation for Node ESM.
- `.gitignore` and `.env.example`: keep credentials and generated production runs out of Git.
- `src/index.ts`: executable command entry point.
- `src/cli.ts`: parses and validates the `run --topic` command.
- `src/models.ts`: shared domain types for candidates, evidence, analysis, scores, and run metadata.
- `src/config.ts`: reads required and optional environment configuration.
- `src/storage.ts`: creates a run directory and writes JSON/Markdown artifacts safely.
- `src/sources/types.ts`: public interface for any candidate source adapter.
- `src/sources/fixture-source.ts`: deterministic source used until a live source is configured.
- `src/research.ts`: converts candidate facts into traceable evidence records.
- `src/scoring.ts`: scores an analysis against the default thesis.
- `src/recommendation.ts`: maps score and evidence quality to a recommendation.
- `src/memo.ts`: renders a citation-bearing Markdown memo.
- `src/pipeline.ts`: coordinates the modules and returns a run summary.
- `tests/*.test.ts`: focused tests for CLI parsing, score/recommendation, storage, and memo rendering.
- `docs/architecture.md`, `docs/thesis.md`, `docs/ai-workflow.md`: reviewer-facing documentation.
- `samples/demo-run/`: a committed example of a complete run layout and memo.
- `README.md`: installation, configuration, execution, output inspection, and limits.

## Task 1: Create The TypeScript CLI Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.ts`
- Create: `src/cli.ts`
- Create: `src/config.ts`
- Create: `tests/cli.test.ts`
- Create: `tests/config.test.ts`

**Interfaces:**
- Produces: `parseCommand(argv: string[]): { topic: string; outputDir?: string }`.
- Produces: `loadConfig(env: NodeJS.ProcessEnv): { runsDir: string; llmApiKey?: string }`.
- Produces: executable `src/index.ts` that invokes `parseCommand(process.argv.slice(2))`.

- [ ] **Step 1: Write the failing command-parser tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "../src/cli.js";

test("parses a run topic", () => {
  assert.deepEqual(parseCommand(["run", "--topic", "AI agents for SMBs"]), {
    topic: "AI agents for SMBs",
  });
});

test("rejects a run without a topic", () => {
  assert.throws(() => parseCommand(["run"]), /--topic is required/);
});

test("uses the standard runs directory when none is configured", () => {
  assert.deepEqual(loadConfig({}), { runsDir: "runs" });
});
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run: `npm test -- tests/cli.test.ts`

Expected: FAIL because `src/cli.ts` does not exist.

- [ ] **Step 3: Add project configuration and minimal parser**

```ts
export function parseCommand(argv: string[]): { topic: string; outputDir?: string } {
  if (argv[0] !== "run") throw new Error("Expected command: run");
  const topicIndex = argv.indexOf("--topic");
  const topic = topicIndex >= 0 ? argv[topicIndex + 1] : undefined;
  if (!topic) throw new Error("--topic is required");
  return { topic };
}
```

Set `package.json` scripts to `dev: "tsx src/index.ts"`, `test: "tsx --test tests/**/*.test.ts"`, `typecheck: "tsc --noEmit"`, and `build: "tsc"`. Use `"type": "module"`, `bin.deal-scout`, and a `volta` object pinned to the global-constraint versions. Make `src/index.ts` print a friendly placeholder summary after parsing.

Implement `loadConfig` without an environment-loading dependency: it reads `DEAL_SCOUT_RUNS_DIR` and `OPENAI_API_KEY` from the supplied object, defaults `runsDir` to `runs`, and omits `llmApiKey` when the key is absent. The future LLM client will receive this config rather than reading `process.env` directly.

- [ ] **Step 4: Run the foundation checks**

Run: `npm test && npm run typecheck && npm run dev -- run --topic "AI agents for SMBs"`

Expected: tests pass, TypeScript reports no errors, and the command prints the parsed topic.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json tsconfig.json .gitignore .env.example src/index.ts src/cli.ts src/config.ts tests/cli.test.ts tests/config.test.ts
git commit -m "chore: bootstrap TypeScript CLI"
```

## Task 2: Define Domain Types And File-Backed Run Storage

**Files:**
- Create: `src/models.ts`
- Create: `src/storage.ts`
- Create: `tests/storage.test.ts`

**Interfaces:**
- Produces: `Candidate`, `Evidence`, `StartupAnalysis`, `Score`, `Recommendation`, and `RunMetadata` types.
- Produces: `createRun(rootDir: string, topic: string): Promise<RunContext>`.
- Produces: `writeJson(run: RunContext, relativePath: string, value: unknown): Promise<void>`.
- Produces: `writeText(run: RunContext, relativePath: string, value: string): Promise<void>`.

- [ ] **Step 1: Write a failing storage test**

```ts
test("creates a traceable run directory", async () => {
  const run = await createRun(tempRoot, "AI agents for SMBs");
  const input = JSON.parse(await readFile(join(run.path, "input.json"), "utf8"));
  assert.equal(input.topic, "AI agents for SMBs");
  assert.match(run.id, /^\d{8}-\d{6}-[a-z0-9]{6}$/);
});
```

- [ ] **Step 2: Run the storage test to verify it fails**

Run: `npm test -- tests/storage.test.ts`

Expected: FAIL because `createRun` is not exported.

- [ ] **Step 3: Implement focused types and storage**

```ts
export type Evidence = {
  claim: string;
  url: string;
  source: string;
  capturedAt: string;
};

export async function createRun(rootDir: string, topic: string): Promise<RunContext> {
  const id = makeRunId();
  const path = join(rootDir, id);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "input.json"), JSON.stringify({ topic, createdAt: new Date().toISOString() }, null, 2));
  return { id, path };
}
```

Use `node:fs/promises` and `node:path`. Reject `relativePath` values that are absolute or include `..` before writing. Add types for all pipeline boundaries, including `StartupAnalysis` fields for team, product, market, risks, and source URLs.

- [ ] **Step 4: Run storage and type checks**

Run: `npm test && npm run typecheck`

Expected: all tests pass and only the test temporary directory is created.

- [ ] **Step 5: Commit storage**

```bash
git add src/models.ts src/storage.ts tests/storage.test.ts
git commit -m "feat: add run artifact storage"
```

## Task 3: Add Candidate Source And Evidence Components

**Files:**
- Create: `src/sources/types.ts`
- Create: `src/sources/fixture-source.ts`
- Create: `src/research.ts`
- Create: `tests/research.test.ts`

**Interfaces:**
- Consumes: `Candidate` and `Evidence` from `src/models.ts`.
- Produces: `CandidateSource` with `name` and `findCandidates(topic, limit)`.
- Produces: `buildEvidence(candidate: Candidate): Evidence[]`.

- [ ] **Step 1: Write failing evidence tests**

```ts
test("keeps only candidate facts with a URL as evidence", () => {
  const evidence = buildEvidence(candidate);
  assert.equal(evidence.length, 2);
  assert.ok(evidence.every((item) => item.url.startsWith("https://")));
});
```

- [ ] **Step 2: Run the research test to verify it fails**

Run: `npm test -- tests/research.test.ts`

Expected: FAIL because `buildEvidence` is missing.

- [ ] **Step 3: Implement the source interface and fixture source**

```ts
export interface CandidateSource {
  readonly name: string;
  findCandidates(topic: string, limit: number): Promise<Candidate[]>;
}

export class FixtureSource implements CandidateSource {
  readonly name = "fixture";
  async findCandidates(topic: string, limit: number): Promise<Candidate[]> {
    return FIXTURE_CANDIDATES.filter((candidate) => candidate.tags.some((tag) => topic.toLowerCase().includes(tag))).slice(0, limit);
  }
}
```

Give each fixture candidate a company URL and a public source URL. `buildEvidence` must only turn present, URL-backed fields into evidence. Do not add an unsupported founder, funding, or traction claim.

- [ ] **Step 4: Run the component tests**

Run: `npm test && npm run typecheck`

Expected: fixture-source and evidence tests pass without network access.

- [ ] **Step 5: Commit source components**

```bash
git add src/sources src/research.ts tests/research.test.ts
git commit -m "feat: add candidate source components"
```

## Task 4: Implement Deterministic Analysis, Scoring, And Recommendation Components

**Files:**
- Create: `src/analysis.ts`
- Create: `src/scoring.ts`
- Create: `src/recommendation.ts`
- Create: `tests/scoring.test.ts`
- Create: `tests/recommendation.test.ts`

**Interfaces:**
- Consumes: `Candidate` and `Evidence` from Tasks 2-3.
- Produces: `analyseCandidate(candidate, evidence): StartupAnalysis`.
- Produces: `scoreAnalysis(analysis): Score`.
- Produces: `recommend(score: Score, evidence: Evidence[]): Recommendation`.

- [ ] **Step 1: Write failing score and recommendation tests**

```ts
test("recommends a meeting for a high-confidence thesis match", () => {
  const score = scoreAnalysis(highSignalAnalysis);
  assert.equal(score.total, 82);
  assert.equal(recommend(score, highSignalEvidence).decision, "Take a meeting");
});

test("caps an evidence-poor candidate at Watch", () => {
  assert.equal(recommend({ total: 84, reasons: [] }, []).decision, "Watch");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/scoring.test.ts tests/recommendation.test.ts`

Expected: FAIL because analysis, scoring, and recommendation modules are missing.

- [ ] **Step 3: Implement explicit, inspectable rules**

```ts
export function scoreAnalysis(analysis: StartupAnalysis): Score {
  const points = [
    analysis.product.workflowClarity * 25,
    analysis.market.smbFit * 20,
    analysis.team.technicalDepth * 20,
    analysis.traction.signalStrength * 20,
    analysis.market.whyNow * 15,
  ];
  return { total: Math.round(points.reduce((sum, value) => sum + value, 0)), reasons: analysis.scoreReasons };
}
```

Use 0-1 criterion values and fixed weights totaling 100. Recommendation thresholds are `Take a meeting` at 75 or higher with at least two evidence records, `Watch` at 50 or higher, and `Pass` below 50. The scaffold analysis implementation derives only what the fixture data supports and creates explicit open questions for missing team or market data.

- [ ] **Step 4: Run deterministic checks**

Run: `npm test && npm run typecheck`

Expected: all score thresholds, evidence caps, and TypeScript checks pass.

- [ ] **Step 5: Commit decision components**

```bash
git add src/analysis.ts src/scoring.ts src/recommendation.ts tests/scoring.test.ts tests/recommendation.test.ts
git commit -m "feat: add scoring and recommendations"
```

## Task 5: Render Citation-Bearing Memos And Orchestrate A Complete Demo Run

**Files:**
- Create: `src/memo.ts`
- Create: `src/pipeline.ts`
- Modify: `src/index.ts`
- Create: `tests/memo.test.ts`
- Create: `tests/pipeline.test.ts`

**Interfaces:**
- Consumes: all preceding components.
- Produces: `renderMemo(input: MemoInput): string`.
- Produces: `runPipeline(input: RunInput): Promise<RunSummary>`.

- [ ] **Step 1: Write failing memo and pipeline tests**

```ts
test("renders a decision and source links", () => {
  const memo = renderMemo(memoInput);
  assert.match(memo, /## Recommendation/);
  assert.match(memo, /Take a meeting/);
  assert.match(memo, /\[Source: YC\]\(https:\/\//);
});

test("writes a complete demo run", async () => {
  const summary = await runPipeline({ topic: "AI agents", rootDir: tempRoot });
  assert.equal(summary.completed, 1);
  assert.ok(await access(join(summary.runPath, "memos", "fixture-co.md")));
});
```

- [ ] **Step 2: Run the integration tests to verify they fail**

Run: `npm test -- tests/memo.test.ts tests/pipeline.test.ts`

Expected: FAIL because memo and pipeline functions are missing.

- [ ] **Step 3: Implement memo rendering and orchestration**

```ts
export async function runPipeline({ topic, rootDir }: RunInput): Promise<RunSummary> {
  const run = await createRun(rootDir, topic);
  const candidates = await new FixtureSource().findCandidates(topic, 20);
  await writeJson(run, "candidates.json", candidates);
  for (const candidate of candidates) {
    const evidence = buildEvidence(candidate);
    const analysis = analyseCandidate(candidate, evidence);
    const score = scoreAnalysis(analysis);
    const recommendation = recommend(score, evidence);
    await writeJson(run, `evidence/${candidate.slug}.json`, evidence);
    await writeJson(run, `analysis/${candidate.slug}.json`, { analysis, score, recommendation });
    await writeText(run, `memos/${candidate.slug}.md`, renderMemo({ candidate, evidence, analysis, score, recommendation }));
  }
  return { runPath: run.path, completed: candidates.length, failed: 0 };
}
```

Render short sections for Product, Team, Market, Risks/Open Questions, Score, and Recommendation. Under each sourced claim, add a Markdown link using the evidence record. Update `src/index.ts` to run the pipeline and print its run directory.

- [ ] **Step 4: Run the CLI end to end**

Run: `npm test && npm run typecheck && npm run dev -- run --topic "AI agents"`

Expected: tests pass, TypeScript passes, and the command prints a fresh run directory containing JSON evidence and Markdown memos.

- [ ] **Step 5: Commit the runnable demo pipeline**

```bash
git add src/index.ts src/memo.ts src/pipeline.ts tests/memo.test.ts tests/pipeline.test.ts
git commit -m "feat: run a traceable demo pipeline"
```

## Task 6: Add Reviewer-Facing Documentation And Committed Sample Output

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/thesis.md`
- Create: `docs/ai-workflow.md`
- Create: `samples/demo-run/input.json`
- Create: `samples/demo-run/candidates.json`
- Create: `samples/demo-run/evidence/fixture-co.json`
- Create: `samples/demo-run/analysis/fixture-co.json`
- Create: `samples/demo-run/memos/fixture-co.md`

**Interfaces:**
- Consumes: actual command names, directories, sample output, and scoring thresholds from Tasks 1-5.
- Produces: a reviewer can install, configure, run, and inspect DealScout without source-code archaeology.

- [ ] **Step 1: Write a documentation acceptance test as a checklist**

```text
README includes: Volta prerequisite, npm install, .env setup, run command,
output layout, sample-output location, test command, limitations, and source
of truth for the investment thesis.
```

- [ ] **Step 2: Verify the checklist fails against the absent documentation**

Run: `test -f README.md`

Expected: non-zero exit status because the README does not exist.

- [ ] **Step 3: Write concise documentation from actual behavior**

`README.md` must provide copy-pasteable commands:

```bash
volta install node@20.10.0 npm@10.2.3
npm install
cp .env.example .env
npm run dev -- run --topic "AI agents for SMBs"
```

Explain `runs/<run-id>/` and link to `samples/demo-run/`. State that fixture data proves the workflow while live YC/HN adapters and an LLM client remain the next milestone. Document the default thesis and score thresholds exactly. In `docs/ai-workflow.md`, include dated entries for: AI-assisted design exploration; human choice of CLI/file-based scope; AI-assisted scaffold generation; human verification by tests/typecheck/manual CLI run; and a short note that no AI-generated claim may enter a memo without captured evidence. Do not claim that an unperformed live-source or LLM run occurred.

- [ ] **Step 4: Generate and inspect sample output**

Run: `npm run dev -- run --topic "AI agents"`

Expected: one or more memos under a fresh `runs/` directory. Copy only stable, non-secret fixture artifacts into `samples/demo-run/`, then manually compare the memo headings and cited URLs to the implementation.

- [ ] **Step 5: Run final documentation and code checks**

Run: `npm test && npm run typecheck && git status --short`

Expected: tests and typecheck pass; status lists only intended documentation and sample-output files before staging.

- [ ] **Step 6: Commit reviewer artifacts**

```bash
git add README.md docs/architecture.md docs/thesis.md docs/ai-workflow.md samples/demo-run
git commit -m "docs: add reviewer guide and AI workflow trail"
```

## Plan Self-Review

- Spec coverage: Tasks 1-5 implement the CLI, file-based run storage, component boundaries, evidence capture, analysis, score, recommendation, memos, and failure-safe deterministic behavior. Task 6 implements the README, thesis, architecture, AI workflow trail, and committed sample output.
- Scope: No task adds a frontend, database, queue, vector store, or authentication. Live YC/HN and LLM integrations are intentionally deferred until the scaffold flow is proven.
- Type consistency: `Candidate` and `Evidence` originate in `src/models.ts`; storage owns `RunContext`; the pipeline owns only orchestration; deterministic analysis, scoring, recommendation, and memo rendering have explicit inputs and outputs.
- Placeholder scan: No implementation steps rely on unspecified files or undefined function names.

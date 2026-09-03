# DealScout

DealScout is a small CLI for investment triage. It interprets a human investment topic into a saved research brief, finds candidates from Y Combinator and Hacker News, captures source evidence, enriches YC candidates from public profiles, scores each result, and writes standalone HTML reports.

## Quick Start

Volta is pinned in `package.json`; after Volta is on your PATH, use normal npm commands:

```bash
npm install
npm run dev -- run --topic "AI agents for SMBs"
```

The command prints each pipeline stage, including whether OpenRouter or the deterministic fallback produced analysis, followed by the run path. Open `runs/<run-id>/report.html` for the partner-readable run view. Run `npm test`, `npm run typecheck`, and `npm audit` before submission.

Discovery has one configured target: up to 11 final candidates. It fetches a broader public pool from YC and HN, then ranks it by relevance and freshness. HN results must be `Show HN` launches. A run may return fewer when relevant public matches do not exist; DealScout does not pad results with loose search matches.

With an OpenRouter key, DealScout makes one planning call before sourcing. It turns the full human input into a specific thesis, target customer, inclusion criteria, exclusions, and six source-search phrases. The literal human topic is always searched alongside those expansions, so the LLM cannot replace a broad request such as `fintech startups` with a narrower one. This is generated per run; there is no hand-maintained industry alias table. Investor, funding, accelerator, event, and job queries are rejected. The saved `research-brief.json` and `query-plan.json` make the interpretation reviewable. The same brief is given to the candidate selector, which may choose only from the retrieved public YC/HN pool. If OpenRouter is unavailable, discovery uses the literal topic plus its meaningful non-generic terms.

## Run Artifacts

```text
runs/<run-id>/
  input.json
  research-brief.json
  thesis.json
  query-plan.json
  candidate-pool.json
  selection.json
  candidates.json
  evidence/<company>.json
  analysis/<company>.json
  profiles/<company>.json
  memos/<company>.html
  report.html
  summary.json
```

Every memo source links to captured public evidence. Missing team, market, or traction data is an open question, not an inferred fact.

## LLM Mode

Set `OPENROUTER_API_KEY` in your shell to request structured JSON analysis through OpenRouter. The default model is `openrouter/free`, which uses an available free model:

```bash
OPENROUTER_API_KEY=your_key npm run dev -- run --topic "AI agents for SMBs"
```

`OPENROUTER_MODEL` optionally overrides the free router. OpenRouter first produces `research-brief.json`, then selects only candidates from the broader YC/HN pool using that same brief and saves its reasons in `selection.json`. It then produces qualitative analysis at `temperature: 0`; final scores and recommendations are calibrated from saved candidate, profile, and evidence records. Without a key, DealScout uses deterministic discovery and analysis, and still completes a run.

Public-source discovery is capped at two concurrent requests to avoid overloading YC and HN. Candidate enrichment, analysis, and memo generation also run with a concurrency of two by default. Override that latter setting with `DEAL_SCOUT_CONCURRENCY` when appropriate, for example `DEAL_SCOUT_CONCURRENCY=1 npm run dev -- run --topic "AI agents for SMBs"`. Keep this low for `openrouter/free`: DealScout retries an OpenRouter `429` up to two times, honoring `Retry-After` when provided, before using deterministic analysis for that individual failure. Run separate CLI processes sequentially rather than in parallel when using a free model.

## Limits

The first version uses YC directory results and HN story search. HN matches can be noisy: this is a triage system, not an automated investment decision. There is no frontend, database, queue, or vector store.

The thesis, architecture, and AI workflow trail are in `docs/thesis.md`, `docs/architecture.md`, and `docs/ai-workflow.md`. See `CONTRIBUTING.md` for code contributions and `AGENTS.md` for an AI-agent working guide.

## Source Layout

`src/index.ts` is the entry point. `cli/` parses commands, `core/` owns shared types/config/storage, `sources/` owns public-source clients, `research/` captures evidence and YC profile enrichment, `prompts/` owns independently editable LLM instructions, `analysis/` owns research planning, analysis, and investment decisions, `reports/` renders standalone HTML reports, and `pipeline/` orchestrates the run. Tests are grouped into `tests/unit/` and `tests/integration/`.

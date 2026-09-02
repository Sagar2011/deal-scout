# DealScout

DealScout is a small CLI for investment triage. It finds startup candidates from Y Combinator and Hacker News, captures source evidence, enriches YC candidates from their public profiles, analyzes each result against a focused thesis, scores it, and writes standalone HTML reports.

## Quick Start

Volta is pinned in `package.json`; after Volta is on your PATH, use normal npm commands:

```bash
npm install
npm run dev -- run --topic "AI agents for SMBs"
```

The command prints each pipeline stage, including whether OpenRouter or the deterministic fallback produced analysis, followed by the run path. Open `runs/<run-id>/report.html` for the partner-readable run view. Run `npm test`, `npm run typecheck`, and `npm audit` before submission.

## Run Artifacts

```text
runs/<run-id>/
  input.json
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

`OPENROUTER_MODEL` optionally overrides the free router. Scores, recommendations, and HTML output remain deterministic. Without a key, DealScout uses its documented fallback analysis and still completes a run.

## Limits

The first version uses YC directory results and HN story search. HN matches can be noisy: this is a triage system, not an automated investment decision. There is no frontend, database, queue, or vector store.

The thesis, architecture, and AI workflow trail are in `docs/thesis.md`, `docs/architecture.md`, and `docs/ai-workflow.md`.

## Source Layout

`src/index.ts` is the entry point. `cli/` parses commands, `core/` owns shared types/config/storage, `sources/` owns public-source clients, `research/` captures evidence and YC profile enrichment, `prompts/` owns the independently editable LLM analysis instruction, `analysis/` owns analysis and investment decisions, `reports/` renders standalone HTML reports, and `pipeline/` orchestrates the run. Tests are grouped into `tests/unit/` and `tests/integration/`.

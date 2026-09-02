# DealScout

DealScout is a small CLI for investment triage. It finds startup candidates from Y Combinator and Hacker News, captures source evidence, enriches YC candidates from their public profiles, analyzes each result against a thesis generated deterministically from the supplied topic, scores it, and writes standalone HTML reports.

## Quick Start

Volta is pinned in `package.json`; after Volta is on your PATH, use normal npm commands:

```bash
npm install
npm run dev -- run --topic "AI agents for SMBs"
```

Use `--limit` to set the maximum number of startup memos for a run, for example `npm run dev -- run --topic "healthcare startup" --limit 3`.

The command prints each pipeline stage, including whether OpenRouter or the deterministic fallback produced analysis, followed by the run path. Open `runs/<run-id>/report.html` for the partner-readable run view. Run `npm test`, `npm run typecheck`, and `npm audit` before submission.

Discovery fetches a wider pool from both sources, ranks candidates by topic relevance and freshness, then returns up to 11 final candidates by default. A candidate must match all meaningful terms in the original topic or in a related planned query; HN results must be `Show HN` launches. A run may return fewer when there are not enough relevant public matches; DealScout does not pad results with loose search matches.

With an OpenRouter key, DealScout makes one bounded query-planning call before sourcing. It keeps the literal topic and adds four related product or technology search queries, so an arbitrary input such as `healthcare startup`, `transport`, or `AI agents for SMBs` does not depend on a hand-maintained sector alias list. Investor, funding, accelerator, and event queries are rejected. If the requested count is not met, one further non-repeating expansion pass is allowed. The complete plan is saved as `query-plan.json`; an expanded query must match all of its meaningful terms before it can admit a candidate, and final ranking still uses the original topic. If public sources still return fewer candidates than requested, the CLI logs the shortfall and continues with the relevant candidates found. Without a key, discovery uses the literal topic only and may need a broader topic or an additional source adapter to meet the requested count.

## Run Artifacts

```text
runs/<run-id>/
  input.json
  thesis.json
  query-plan.json
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

`OPENROUTER_MODEL` optionally overrides the free router. OpenRouter first produces a small, saved set of related discovery queries, then produces the qualitative analysis at `temperature: 0`; final scores and recommendations are then calibrated from the saved candidate, profile, and evidence records. This keeps repeated runs stable when the captured evidence is unchanged. Without a key, DealScout uses its documented fallback analysis and literal-topic discovery, and still completes a run.

Candidate enrichment, analysis, and memo generation run with a concurrency of two by default. Override it with `DEAL_SCOUT_CONCURRENCY` when appropriate, for example `DEAL_SCOUT_CONCURRENCY=1 npm run dev -- run --topic "AI agents for SMBs"`. Keep this low for `openrouter/free`: DealScout retries an OpenRouter `429` up to two times, honoring `Retry-After` when provided, before using deterministic analysis for that individual failure. Run separate CLI processes sequentially rather than in parallel when using a free model.

## Limits

The first version uses YC directory results and HN story search. HN matches can be noisy: this is a triage system, not an automated investment decision. There is no frontend, database, queue, or vector store.

The thesis, architecture, and AI workflow trail are in `docs/thesis.md`, `docs/architecture.md`, and `docs/ai-workflow.md`. See `CONTRIBUTING.md` for code contributions and `AGENTS.md` for an AI-agent working guide.

## Source Layout

`src/index.ts` is the entry point. `cli/` parses commands, `core/` owns shared types/config/storage, `sources/` owns public-source clients, `research/` captures evidence and YC profile enrichment, `prompts/` owns the independently editable LLM analysis instruction, `analysis/` owns analysis and investment decisions, `reports/` renders standalone HTML reports, and `pipeline/` orchestrates the run. Tests are grouped into `tests/unit/` and `tests/integration/`.

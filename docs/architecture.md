# Architecture

`run --topic <topic>` runs a file-backed pipeline:

1. `analysis/research-planner.ts` asks OpenRouter to interpret the complete human topic into a thesis, target customer, inclusion/exclusion criteria, and six source-search queries. The literal topic is retained alongside the generated phrases. `research-brief.json` and `query-plan.json` record this bounded planning step. Live discovery aborts if planning or candidate selection fails; it does not substitute a heuristic relevance filter.
2. `sources/` retrieves candidates from YC and Hacker News with Axios, deduplicates them, and ranks the broader pool by relevance and freshness. Source requests are capped at two concurrent calls. The configured target is 11 candidates; a shortfall is logged rather than padded.
3. `research/yc-profile.ts` enriches YC candidates with public founder bios and team context; `research/evidence.ts` persists those claims as evidence records.
4. `analysis/` contains fallback/LLM analysis, scoring, and recommendations.
5. `prompts/` keeps the LLM analysis instruction independently reviewable and refinable.
6. `analysis/llm.ts` optionally calls OpenRouter with `openrouter/free` by default and falls back on invalid or unavailable model output.
7. `reports/memo.ts` renders standalone HTML company memos and a linked run report with citations.
8. `core/storage.ts` persists every artifact under one run directory.
9. `pipeline/` coordinates source discovery and the complete run.

The pipeline depends on small contracts for sources, research planners, candidate selectors, enrichers, analysis providers, report renderers, and run storage. `pipeline/defaults.ts` registers today's YC, Hacker News, YC-profile, OpenRouter, HTML, and file-store adapters. Add a future source, provider, planner, or database-backed store by implementing its contract and registering it there; the orchestration stays unchanged.

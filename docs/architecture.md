# Architecture

`run --topic <topic>` runs a file-backed pipeline:

1. `sources/` retrieves candidates from YC and Hacker News with Axios.
2. `research/yc-profile.ts` enriches YC candidates with public founder bios and team context; `research/evidence.ts` persists those claims as evidence records.
3. `analysis/` contains fallback/LLM analysis, scoring, and recommendations.
4. `prompts/` keeps the LLM analysis instruction independently reviewable and refinable.
5. `analysis/llm.ts` optionally calls OpenRouter with `openrouter/free` by default and falls back on invalid or unavailable model output.
6. `reports/memo.ts` renders standalone HTML company memos and a linked run report with citations.
7. `core/storage.ts` persists every artifact under one run directory.
8. `pipeline/` coordinates source discovery and the complete run.

The pipeline depends on small contracts for sources, enrichers, analysis providers, report renderers, and run storage. `pipeline/defaults.ts` registers today's YC, Hacker News, YC-profile, OpenRouter, HTML, and file-store adapters. Add a future source, provider, or database-backed store by implementing its contract and registering it there; the orchestration stays unchanged.

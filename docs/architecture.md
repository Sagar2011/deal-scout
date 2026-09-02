# Architecture

`run --topic <topic>` runs a file-backed pipeline:

1. `sources/` retrieves candidates from YC and Hacker News with Axios.
2. `research/evidence.ts` turns source-backed candidate facts into evidence records.
3. `analysis/` contains fallback/LLM analysis, scoring, and recommendations.
4. `reports/memo.ts` renders a short Markdown brief with citations.
5. `core/storage.ts` persists every artifact under one run directory.
6. `pipeline/` coordinates source discovery and the complete run.

The boundaries are plain TypeScript modules. A failure for one candidate does not discard completed artifacts for others. This is deliberately not a service architecture.

# AI Workflow Trail

## 2026-09-01: Scope And Design

AI assistance helped turn the assignment into a CLI-first, file-backed design. The human decisions were to avoid a frontend, database, queue, and vector store; use YC plus Hacker News; and name the project DealScout. The design and implementation plan were written before code.

## 2026-09-02: Implementation And Validation

AI assistance helped draft focused TypeScript modules and tests. The human requested Axios with exact versions and a dependency audit. Axios 1.7.0 and then 1.8.2 were rejected after security checks; the project uses exact Axios 1.20.0, which passed `npm audit` with zero reported vulnerabilities at implementation time.

The implementation was validated with source-adapter tests, pipeline artifact tests, TypeScript checks, a build, and a live YC/HN run. AI-generated analysis is optional and never treated as a source: memo claims must point to public evidence, and missing facts become open questions.

## Deliberate Limits

The fallback analysis is deterministic so a reviewer can run the project without an API key. LLM output structures research, while the final score and recommendation remain transparent and deterministic.

The LLM analysis prompt lives in `src/prompts/` so it can be reviewed and refined independently. The optional adapter uses OpenRouter and defaults to `openrouter/free`. HTML memos are always rendered deterministically from captured evidence, structured analysis, fixed score, and fixed recommendation.

## 2026-09-02: Structure Cleanup

The initial working implementation had several modules at the `src/` root. The code was then reorganized by responsibility into `core`, `cli`, `sources`, `research`, `analysis`, `reports`, and `pipeline`, with unit and integration tests separated. This was a behavior-preserving refactor verified by the same test, typecheck, build, audit, and live-run checks.

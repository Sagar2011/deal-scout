# AI Workflow Trail

## 2026-09-01: Scope And Design

AI assistance helped turn the assignment into a CLI-first, file-backed design. The human decisions were to avoid a frontend, database, queue, and vector store; use YC plus Hacker News; and name the project DealScout. The design and implementation plan were written before code.

## 2026-09-02: Implementation And Validation

AI assistance helped draft focused TypeScript modules and tests. The human requested Axios with exact versions and a dependency audit. Axios 1.7.0 and then 1.8.2 were rejected after security checks; the project uses exact Axios 1.20.0, which passed `npm audit` with zero reported vulnerabilities at implementation time.

The implementation was validated with source-adapter tests, pipeline artifact tests, TypeScript checks, a build, and a live YC/HN run. AI-generated analysis is optional and never treated as a source: memo claims must point to public evidence, and missing facts become open questions.

## Deliberate Limits

The fallback analysis is deterministic so a reviewer can run the project without an API key. With OpenRouter enabled, one pre-sourcing call turns the full human topic into a saved `research-brief.json`: a one-sentence thesis, target customer, inclusion criteria, exclusions, and six source-search phrases. The literal human topic is always searched alongside the generated phrases, and the prompt explicitly forbids adding constraints absent from the human request. There is no sector-specific alias table. The same brief drives public-source search and candidate selection, while the selector is constrained to IDs in the retrieved YC/HN pool. Source calls are capped at two concurrent requests. The LLM then structures qualitative research at `temperature: 0`; final scores are independently calibrated from captured evidence, candidate metadata, and verified profile facts. This prevents a different free-model response from materially changing a score when the saved evidence is unchanged.

The LLM prompts live in `src/prompts/` so topic interpretation, candidate selection, and analysis can be reviewed and refined independently. The optional adapter uses OpenRouter and defaults to `openrouter/free`. HTML memos are always rendered deterministically from captured evidence, structured analysis, fixed score, and fixed recommendation.

## 2026-09-02: Structure Cleanup

The initial working implementation had several modules at the `src/` root. The code was then reorganized by responsibility into `core`, `cli`, `sources`, `research`, `analysis`, `reports`, and `pipeline`, with unit and integration tests separated. This was a behavior-preserving refactor verified by the same test, typecheck, build, audit, and live-run checks.

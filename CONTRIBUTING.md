# Contributing To DealScout

## Before You Change Code

1. Read `README.md`, `docs/thesis.md`, and `docs/architecture.md`.
2. Keep the pipeline CLI-first and file-backed. Do not add a web service, database, queue, or frontend unless the scope explicitly changes.
3. Preserve traceability: every factual statement in a report needs public evidence or must be written as an open question.

## Extension Points

Register production adapters in `src/pipeline/defaults.ts`.

- Add a discovery platform by implementing `CandidateSource`.
- Add founder, traction, or product research by implementing `CandidateEnricher`.
- Add an LLM provider by implementing `AnalysisProvider`.
- Add another presentation format by implementing `ReportRenderer`.
- Add database persistence later by implementing `RunStore`; keep `fileRunStore` as the local default.

Do not put provider-specific conditions in `pipeline/run.ts`. The pipeline orchestrates contracts; adapters own external API details.

## Quality Bar

- Use exact dependency versions. Do not add a package without a clear need.
- Keep secrets only in the ignored `.env`; never commit keys or paste them into examples.
- Add or update a focused test before changing behavior.
- Keep deterministic scoring and recommendation logic transparent. LLM output may structure analysis but is never evidence.

Run these before opening a pull request:

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Pull Requests

Describe the user-facing behavior, source/evidence impact, tests run, and any intentional limitation. For a new source, include one captured run artifact so reviewers can spot-check its claims.

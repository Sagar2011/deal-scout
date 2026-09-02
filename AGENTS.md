# AI Agent Guide

Use coding agents as collaborators, not as unreviewed code generators.

## Working Loop

1. Read the relevant module and tests before proposing edits.
2. State the smallest change and its acceptance condition.
3. Write or update a focused test first, then implement only what makes it pass.
4. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm audit --audit-level=high`.
5. Report what changed, what was verified, and any gap honestly.

## Repository Rules

- Do not read, print, commit, or echo `.env` values.
- Do not invent investment facts. Treat unsupported facts as open questions.
- Do not make an LLM output appear as a source. Cite public evidence URLs in the generated report.
- Keep external integrations in adapters and register them in `src/pipeline/defaults.ts`.
- Keep changes narrow. Ask before adding infrastructure or dependencies.
- Never stage, commit, or push unless explicitly asked.

## Useful Prompts

Use these as starting points when asking an agent for help:

```text
Read the existing CandidateSource adapters and add one new public source.
Use the existing contracts, add a focused fixture test, preserve evidence URLs,
and do not change scoring or report rendering.
```

```text
Add an enricher for this public profile page. Extract only verified fields,
persist the profile artifact, update deterministic analysis conservatively,
and add parser fixtures for missing or malformed fields.
```

```text
Review this run artifact for unsupported claims, weak source matches, and
misleading scores. Do not edit code. Return findings with file paths.
```

## Human Review Checklist

- Does every report claim have public evidence?
- Does the change preserve deterministic fallback behavior?
- Does the new adapter implement a contract rather than modify orchestration?
- Do the checks pass with no API key?

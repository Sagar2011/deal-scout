# DealScout Design

## Goal

DealScout is a small internal CLI that turns a startup topic into a ranked,
traceable set of investment memos. It automates triage; it does not replace a
partner's decision-making.

## Scope

The first release accepts a topic and gathers candidates from two public
sources: Y Combinator and Hacker News. It collects 10-20 candidates when the
sources have enough relevant data, captures supporting evidence, evaluates each
company against a stated thesis, and writes a one-page Markdown memo.

It deliberately excludes a web UI, database, queue, vector database, account
system, and automated investment decisions.

## Thesis

The default thesis is: seed-stage B2B companies using AI agents to automate
repeatable, high-volume workflows for small and medium-sized businesses. Strong
candidates have a clear workflow owner, a measurable ROI story, evidence of
technical execution, and a believable path through adoption and distribution.

The thesis is configurable in a small text or JSON configuration file so the
scoring criteria stay explicit and repeatable.

## Architecture

The application is a Node.js and TypeScript command-line program. Volta pins
the Node and package-manager versions. A single orchestration command delegates
to small modules with clear responsibilities:

- `cli`: parses commands and validates user input.
- `sources`: fetches and normalizes candidates from YC and Hacker News.
- `research`: collects public-page evidence for a candidate.
- `analysis`: asks an LLM for structured analysis grounded in the evidence.
- `scoring`: turns explicit thesis criteria into a 0-100 score.
- `recommendation`: maps score and evidence quality to Pass, Watch, or Take a
  meeting.
- `memo`: renders a partner-readable Markdown memo with citations.
- `storage`: reads and writes run artifacts on disk.

The system uses simple files rather than a database. This keeps every run
inspectable and replayable, which is more valuable than operational complexity
for this take-home.

## Data Flow

`deal-scout run --topic <topic>` creates `runs/<run-id>/` and writes input
metadata first. It then sources candidates, persists normalized candidates and
raw source references, researches public evidence, produces a validated
structured analysis, calculates the score and recommendation, and renders one
memo per candidate.

Artifacts include the original input, candidates, evidence, analysis JSON,
and `memos/*.md`. Every externally sourced claim in a memo must link to an
evidence record. If evidence is unavailable, the memo labels the point as an
open question rather than inventing a claim.

## CLI Surface

The first scaffold exposes a simple command shape:

```text
deal-scout run --topic "AI agents for SMBs"
```

Configuration comes from environment variables and a committed example file.
An LLM API key is optional for the scaffold; without one, the program will
clearly report that analysis cannot run rather than silently producing
fabricated analysis.

## Error Handling

Failures are isolated by candidate and source where possible. A failed source
or research page is recorded in the run metadata while the remaining candidates
continue. Invalid LLM output is rejected and recorded; it is never rendered as
a memo. The final command prints the run directory and a compact summary of
completed and failed candidates.

## Testing

Tests focus on deterministic behavior: score calculation, recommendation
thresholds, memo citation rendering, and input validation. Source and LLM
clients are defined behind narrow interfaces so tests use fixtures rather than
network calls.

## Documentation And AI Workflow Trail

The repository will include:

- `README.md`: prerequisites, Volta setup, environment configuration, command
  examples, expected output layout, and troubleshooting.
- `docs/architecture.md`: a concise explanation of pipeline stages and the
  deliberate scope boundaries.
- `docs/thesis.md`: the scoring thesis and criteria.
- `docs/ai-workflow.md`: an honest, dated account of AI assistance, including
  prompts or decision summaries that influenced implementation, author review
  and validation steps, and rejected alternatives. It will distinguish AI
  suggestions from human decisions and avoid retrospective padding.

## Definition Of Done

A reviewer can install dependencies, set environment variables, run one
command for a topic, inspect committed sample output, and trace memo claims to
captured public evidence. The repository shows a concise, credible trail of
how AI contributed to the work.

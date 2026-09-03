import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterCandidateSelector } from "../../src/analysis/candidate-selector.js";
import type { Candidate, ResearchBrief } from "../../src/core/models.js";
import { buildCandidateSelectionPrompt } from "../../src/prompts/candidate-selection.js";

const candidates: Candidate[] = [
  {
    name: "Relevant Agent",
    website: "https://relevant.example",
    description: "AI support agents for small businesses.",
    source: "Y Combinator",
    sourceUrl: "https://www.ycombinator.com/companies/relevant-agent",
    signal: "YC Winter 2025 company listing",
  },
];

const brief: ResearchBrief = {
  topic: "AI agents for SMBs",
  thesis: "AI agents that automate small-business workflows.",
  targetCustomer: "Small businesses",
  inclusionCriteria: ["Explicit small-business workflow"],
  exclusions: ["Generic developer tools"],
  queries: ["AI support for small businesses"],
};

test("keeps only source URLs returned from the candidate pool", async () => {
  const selector = new OpenRouterCandidateSelector(
    "test-key",
    "openrouter/free",
    {
      async get() {
        throw new Error("not used");
      },
      async post() {
        return {
          data: {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    selected: [
                      {
                        candidateId: 0,
                        reason: "Explicit small-business support workflow.",
                      },
                      {
                        candidateId: 99,
                        reason: "Not in the pool.",
                      },
                    ],
                  }),
                },
              },
            ],
          },
        };
      },
    }
  );

  const result = await selector.select(brief, candidates, 11);

  assert.deepEqual(result.candidates, candidates);
  assert.deepEqual(result.reasons, [
    {
      sourceUrl: candidates[0].sourceUrl,
      reason: "Explicit small-business support workflow.",
    },
  ]);
});

test("treats the human topic as the relevance boundary", () => {
  const prompt = buildCandidateSelectionPrompt(brief, candidates, 11);
  assert.match(prompt, /human topic is the relevance boundary/i);
  assert.match(prompt, /exactly 11/i);
});

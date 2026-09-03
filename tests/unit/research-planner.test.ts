import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterResearchPlanner } from "../../src/analysis/research-planner.js";
import { createFallbackResearchBrief } from "../../src/core/thesis.js";
import { buildResearchBriefPrompt } from "../../src/prompts/research-brief.js";

test("turns a combined topic into a reusable research brief", async () => {
  const planner = new OpenRouterResearchPlanner("test-key", "openrouter/free", {
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
                  thesis:
                    "Seed-stage AI agents that automate repeatable workflows for small businesses.",
                  targetCustomer: "Small and medium businesses",
                  inclusionCriteria: [
                    "AI agent that completes a business workflow",
                    "Small-business customer is explicit",
                  ],
                  exclusions: ["Generic developer tools", "Consumer chatbots"],
                  queries: [
                    "AI agents for small businesses",
                    "small business workflow automation",
                    "AI customer support SMB",
                    "AI back office automation",
                    "AI operations for SMBs",
                    "small business automation agent",
                  ],
                }),
              },
            },
          ],
        },
      };
    },
  });

  assert.deepEqual(await planner.plan("AI agents for SMBs"), {
    topic: "AI agents for SMBs",
    thesis:
      "Seed-stage AI agents that automate repeatable workflows for small businesses.",
    targetCustomer: "Small and medium businesses",
    inclusionCriteria: [
      "AI agent that completes a business workflow",
      "Small-business customer is explicit",
    ],
    exclusions: ["Generic developer tools", "Consumer chatbots"],
    queries: [
      "AI agents for small businesses",
      "small business workflow automation",
      "AI customer support SMB",
      "AI back office automation",
      "AI operations for SMBs",
      "small business automation agent",
    ],
  });
});

test("rejects investor and funding searches from a research brief", async () => {
  const planner = new OpenRouterResearchPlanner("test-key", "openrouter/free", {
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
                  thesis: "Gaming companies.",
                  targetCustomer: "Gamers",
                  inclusionCriteria: [
                    "Gaming product",
                    "Direct player or game-studio workflow",
                  ],
                  exclusions: [],
                  queries: [
                    "indie game development",
                    "gaming venture capital firms",
                    "video game funding",
                  ],
                }),
              },
            },
          ],
        },
      };
    },
  });

  const brief = await planner.plan("gaming startup");
  assert.deepEqual(brief.queries, ["indie game development"]);
});

test("instructs the planner not to invent narrower constraints", () => {
  const prompt = buildResearchBriefPrompt("fintech startups");
  assert.match(prompt, /must not add constraints/i);
  assert.match(prompt, /keep the thesis broad/i);
});

test("derives a generic fallback query when LLM planning is unavailable", () => {
  assert.deepEqual(createFallbackResearchBrief("fintech startups").queries, [
    "fintech startups",
    "fintech",
  ]);
});

test("reports a malformed OpenRouter response without a TypeError", async () => {
  const planner = new OpenRouterResearchPlanner("test-key", "openrouter/free", {
    async get() {
      throw new Error("not used");
    },
    async post() {
      return { data: {} } as never;
    },
  });

  await assert.rejects(
    planner.plan("fintech startups"),
    /OpenRouter response contained no completion/
  );
});

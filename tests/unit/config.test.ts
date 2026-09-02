import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../../src/core/config.js";

test("uses the standard runs directory when none is configured", () => {
  assert.deepEqual(loadConfig({}), { runsDir: "runs", concurrency: 2 });
});

test("reads configured run and LLM settings", () => {
  assert.deepEqual(
    loadConfig({
      DEAL_SCOUT_RUNS_DIR: "tmp/runs",
      OPENROUTER_API_KEY: "test-key",
    }),
    {
      runsDir: "tmp/runs",
      concurrency: 2,
      llmApiKey: "test-key",
      llmModel: "openrouter/free",
    }
  );
});

test("accepts an optional OpenRouter model override", () => {
  assert.deepEqual(
    loadConfig({
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_MODEL: "meta-llama/llama-3.3-70b-instruct:free",
    }),
    {
      runsDir: "runs",
      concurrency: 2,
      llmApiKey: "test-key",
      llmModel: "meta-llama/llama-3.3-70b-instruct:free",
    }
  );
});

test("accepts a positive concurrency override", () => {
  assert.equal(loadConfig({ DEAL_SCOUT_CONCURRENCY: "2" }).concurrency, 2);
});

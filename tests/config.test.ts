import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("uses the standard runs directory when none is configured", () => {
  assert.deepEqual(loadConfig({}), { runsDir: "runs" });
});

test("reads configured run and LLM settings", () => {
  assert.deepEqual(
    loadConfig({ DEAL_SCOUT_RUNS_DIR: "tmp/runs", OPENAI_API_KEY: "test-key" }),
    { runsDir: "tmp/runs", llmApiKey: "test-key" },
  );
});

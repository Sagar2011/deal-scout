import assert from "node:assert/strict";
import test from "node:test";

import { retryOpenRouter } from "../../src/analysis/openrouter-retry.js";

test("retries a rate-limited OpenRouter request", async () => {
  let attempts = 0;
  const waits: number[] = [];

  const result = await retryOpenRouter(
    async () => {
      attempts += 1;
      if (attempts === 1)
        throw { response: { status: 429, headers: { "retry-after": "0" } } };
      return "success";
    },
    async (milliseconds) => {
      waits.push(milliseconds);
    }
  );

  assert.equal(result, "success");
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [0]);
});

test("does not retry a non-rate-limit failure", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      retryOpenRouter(async () => {
        attempts += 1;
        throw new Error("network error");
      }),
    /network error/
  );

  assert.equal(attempts, 1);
});

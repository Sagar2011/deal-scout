import assert from "node:assert/strict";
import test from "node:test";

import { retryOpenRouter } from "../../src/analysis/openrouter-retry.js";
import { withOpenRouterTimeout } from "../../src/analysis/openrouter-timeout.js";

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

test("retries a canceled OpenRouter request", async () => {
  let attempts = 0;
  const waits: number[] = [];

  const result = await retryOpenRouter(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("canceled");
      return "success";
    },
    async (milliseconds) => {
      waits.push(milliseconds);
    }
  );

  assert.equal(result, "success");
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [1_000]);
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

test("aborts a request that exceeds the OpenRouter timeout", async () => {
  await assert.rejects(
    () =>
      withOpenRouterTimeout(
        (signal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () =>
              reject(new Error("aborted"))
            );
          }),
        1
      ),
    /aborted/
  );
});

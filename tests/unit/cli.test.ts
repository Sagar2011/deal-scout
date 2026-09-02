import assert from "node:assert/strict";
import test from "node:test";

import { parseCommand } from "../../src/cli/command.js";

test("parses a run topic", () => {
  assert.deepEqual(parseCommand(["run", "--topic", "AI agents for SMBs"]), {
    topic: "AI agents for SMBs",
  });
});

test("rejects a run without a topic", () => {
  assert.throws(() => parseCommand(["run"]), /--topic is required/);
});

test("rejects an unknown command", () => {
  assert.throws(() => parseCommand(["inspect", "--topic", "AI agents"]), /Expected command: run/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { parseCommand } from "../../src/cli/command.js";

test("parses a run topic", () => {
  assert.deepEqual(parseCommand(["run", "--topic", "AI agents for SMBs"]), {
    topic: "AI agents for SMBs",
  });
});

test("parses an optional candidate limit", () => {
  assert.deepEqual(parseCommand(["run", "--topic", "health startup", "--limit", "3"]), {
    topic: "health startup",
    limit: 3,
  });
});

test("rejects an invalid candidate limit", () => {
  assert.throws(
    () => parseCommand(["run", "--topic", "health startup", "--limit", "0"]),
    /--limit must be a positive integer/
  );
});

test("rejects a run without a topic", () => {
  assert.throws(() => parseCommand(["run"]), /--topic is required/);
});

test("rejects an unknown command", () => {
  assert.throws(
    () => parseCommand(["inspect", "--topic", "AI agents"]),
    /Expected command: run/
  );
});

#!/usr/bin/env node

import { parseCommand } from "./cli/command.js";
import { loadConfig } from "./core/config.js";
import { runPipeline } from "./pipeline/run.js";

const command = parseCommand(process.argv.slice(2));
const config = loadConfig(process.env);
const summary = await runPipeline({
  topic: command.topic,
  rootDir: config.runsDir,
  llmApiKey: config.llmApiKey,
});

console.log(
  `Completed ${summary.completed} startup memos for "${command.topic}".`
);
console.log(`Run artifacts: ${summary.runPath}`);
if (summary.failed)
  console.log(
    `Skipped ${summary.failed} candidates: ${summary.failures.join("; ")}`
  );

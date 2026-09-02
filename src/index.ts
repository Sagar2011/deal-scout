#!/usr/bin/env node

import { parseCommand } from "./cli.js";
import { loadConfig } from "./config.js";

const command = parseCommand(process.argv.slice(2));
const config = loadConfig(process.env);

console.log(`DealScout is ready to research "${command.topic}".`);
console.log(`Run artifacts will be written to ${config.runsDir}.`);

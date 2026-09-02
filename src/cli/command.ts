export type RunCommand = {
  topic: string;
  limit?: number;
};

export function parseCommand(argv: string[]): RunCommand {
  if (argv[0] !== "run") {
    throw new Error("Expected command: run");
  }

  const topicIndex = argv.indexOf("--topic");
  const topic = topicIndex === -1 ? undefined : argv[topicIndex + 1];

  if (!topic) {
    throw new Error("--topic is required");
  }

  const limitIndex = argv.indexOf("--limit");
  const limitValue = limitIndex === -1 ? undefined : argv[limitIndex + 1];
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  return limit === undefined ? { topic } : { topic, limit };
}

export type RunCommand = {
  topic: string;
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

  return { topic };
}

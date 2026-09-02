export type AppConfig = {
  runsDir: string;
  llmApiKey?: string;
  llmModel?: string;
  concurrency: number;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const config: AppConfig = {
    runsDir: env.DEAL_SCOUT_RUNS_DIR || "runs",
    concurrency: parseConcurrency(env.DEAL_SCOUT_CONCURRENCY || 2),
  };

  if (env.OPENROUTER_API_KEY) {
    config.llmApiKey = env.OPENROUTER_API_KEY;
    config.llmModel = env.OPENROUTER_MODEL || "openrouter/free";
  }

  return config;
}

function parseConcurrency(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}

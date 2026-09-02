export type AppConfig = {
  runsDir: string;
  llmApiKey?: string;
  llmModel?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const config: AppConfig = {
    runsDir: env.DEAL_SCOUT_RUNS_DIR || "runs",
  };

  if (env.OPENROUTER_API_KEY) {
    config.llmApiKey = env.OPENROUTER_API_KEY;
    config.llmModel = env.OPENROUTER_MODEL || "openrouter/free";
  }

  return config;
}

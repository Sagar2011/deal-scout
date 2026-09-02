export type AppConfig = {
  runsDir: string;
  llmApiKey?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const config: AppConfig = {
    runsDir: env.DEAL_SCOUT_RUNS_DIR || "runs",
  };

  if (env.OPENAI_API_KEY) {
    config.llmApiKey = env.OPENAI_API_KEY;
  }

  return config;
}

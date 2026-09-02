import axios from "axios";
import type { PipelineDependencies } from "../core/contracts.js";
import { fileRunStore } from "../core/storage.js";
import { OpenRouterAnalyzer } from "../analysis/llm.js";
import { OpenRouterQueryExpander } from "../analysis/query-expander.js";
import { renderMemo, renderRunReport } from "../reports/memo.js";
import { enrichYcProfile } from "../research/yc-profile.js";
import { collectCompanyWebsiteEvidence } from "../research/company-website.js";
import { HackerNewsSource } from "../sources/hacker-news.js";
import type { HttpClient } from "../sources/types.js";
import { YcSource } from "../sources/yc.js";

export function createDefaultDependencies(input: {
  http?: HttpClient;
  llmApiKey?: string;
  llmModel?: string;
}): PipelineDependencies {
  const http = input.http ?? axios;
  return {
    sources: [new YcSource(http), new HackerNewsSource(http)],
    enrichers: [
      {
        name: "YC company profile",
        supports: (candidate) => candidate.source === "Y Combinator",
        enrich: (candidate) => enrichYcProfile(candidate, http),
      },
    ],
    evidenceCollectors: [
      {
        name: "company website metadata",
        collect: (candidate) => collectCompanyWebsiteEvidence(candidate, http),
      },
    ],
    queryExpander: input.llmApiKey
      ? new OpenRouterQueryExpander(
          input.llmApiKey,
          input.llmModel ?? "openrouter/free"
        )
      : undefined,
    analyzer: input.llmApiKey
      ? new OpenRouterAnalyzer(
          input.llmApiKey,
          input.llmModel ?? "openrouter/free"
        )
      : undefined,
    renderer: { renderMemo, renderRunReport },
    store: fileRunStore,
  };
}

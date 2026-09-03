import axios from "axios";
import type { ResearchBrief } from "../core/models.js";
import { buildResearchBriefPrompt } from "../prompts/research-brief.js";
import type { HttpClient } from "../sources/types.js";
import { retryOpenRouter } from "./openrouter-retry.js";
import { withOpenRouterTimeout } from "./openrouter-timeout.js";

const ECOSYSTEM_QUERY_PATTERN =
  /\b(?:venture capital|vc|investors?|fund(?:ing|s)?|angels?|accelerators?|incubators?|networks?|opportunit(?:y|ies)|firms?|events?|jobs?)\b/i;

export class OpenRouterResearchPlanner {
  readonly name = "OpenRouter research planner";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async plan(topic: string): Promise<ResearchBrief> {
    const response = await retryOpenRouter(() =>
      withOpenRouterTimeout((signal) =>
        this.http.post<{ choices: Array<{ message: { content: string } }> }>(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: this.model,
            temperature: 0,
            messages: [
              { role: "user", content: buildResearchBriefPrompt(topic) },
            ],
          },
          {
            headers: { Authorization: `Bearer ${this.apiKey}` },
            signal,
            timeout: 60_000,
          }
        )
      )
    );
    const content = (
      response.data as {
        choices?: Array<{ message?: { content?: string } }>;
      }
    ).choices?.[0]?.message?.content;
    if (!content)
      throw new Error("OpenRouter response contained no completion");
    return normalizeResearchBrief(content, topic);
  }
}

function normalizeResearchBrief(content: string, topic: string): ResearchBrief {
  const value = JSON.parse(
    content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()
  ) as Record<string, unknown>;
  const thesis = readText(value.thesis, "thesis");
  const targetCustomer = readText(value.targetCustomer, "target customer");
  const inclusionCriteria = readTextList(
    value.inclusionCriteria,
    "inclusion criteria",
    2,
    4
  );
  const exclusions = readTextList(value.exclusions, "exclusions", 0, 4);
  const queries = readTextList(value.queries, "queries", 1, 6)
    .filter((query) => query.length >= 2 && query.length <= 80)
    .filter((query) => !ECOSYSTEM_QUERY_PATTERN.test(query));
  if (!queries.length) throw new Error("LLM returned no safe source queries");
  return {
    topic: topic.trim(),
    thesis,
    targetCustomer,
    inclusionCriteria,
    exclusions,
    queries,
  };
}

function readText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`LLM returned no ${label}`);
  return value.trim();
}

function readTextList(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
): string[] {
  if (!Array.isArray(value)) throw new Error(`LLM returned no ${label}`);
  const list = [
    ...new Map(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item])
    ).values(),
  ].slice(0, maximum);
  if (list.length < minimum)
    throw new Error(`LLM returned insufficient ${label}`);
  return list;
}

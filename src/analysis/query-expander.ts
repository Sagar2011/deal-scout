import axios from "axios";
import type { HttpClient } from "../sources/types.js";

const ECOSYSTEM_QUERY_PATTERN =
  /\b(?:venture capital|vc|investors?|fund(?:ing|s)?|angels?|accelerators?|incubators?|networks?|opportunit(?:y|ies)|firms?)\b/i;

export class OpenRouterQueryExpander {
  readonly name = "OpenRouter query planner";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async expand(
    topic: string,
    excludedQueries: string[] = []
  ): Promise<string[]> {
    const excluded = new Set(
      excludedQueries.map((query) => query.trim().toLowerCase())
    );
    const exclusionInstruction = excludedQueries.length
      ? ` Do not repeat any of these existing queries: ${JSON.stringify(
          excludedQueries
        )}.`
      : "";
    const response = await this.http.post<{
      choices: Array<{ message: { content: string } }>;
    }>(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Return JSON only as {"queries":[...]}. Given the startup investment topic ${JSON.stringify(
              topic
            )}, provide exactly 4 distinct public-directory search queries for startup products, customers, or the underlying technology. Broaden the topic without changing its sector. Never return queries about investors, venture capital, funds, funding, angels, accelerators, incubators, networks, firms, opportunities, or events. Do not include generic words such as startup, company, or platform.${exclusionInstruction}`,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    const content = response.data.choices[0]?.message.content ?? "";
    const value = JSON.parse(
      content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    ) as { queries?: unknown };
    if (!Array.isArray(value.queries))
      throw new Error("LLM returned no query plan");
    return [
      ...new Map(
        value.queries
          .filter((query): query is string => typeof query === "string")
          .map((query) => query.trim())
          .filter((query) => query.length > 1 && query.length <= 80)
          .filter((query) => !ECOSYSTEM_QUERY_PATTERN.test(query))
          .filter((query) => !excluded.has(query.toLowerCase()))
          .map((query) => [query.toLowerCase(), query])
      ).values(),
    ].slice(0, 4);
  }
}

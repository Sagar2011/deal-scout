import axios from "axios";
import type { HttpClient } from "../sources/types.js";

export class OpenRouterQueryExpander {
  readonly name = "OpenRouter query planner";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async expand(topic: string): Promise<string[]> {
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
            )}, provide 2 to 4 distinct public-directory search queries that broaden the topic without changing its sector. Do not include generic words such as startup, company, or platform.`,
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
          .map((query) => [query.toLowerCase(), query])
      ).values(),
    ].slice(0, 4);
  }
}

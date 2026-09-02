import axios from "axios";
import type { Candidate, Evidence, StartupAnalysis } from "../core/models.js";
import { buildAnalysisPrompt } from "../prompts/investment-analysis.js";
import {
  buildMemoPrompt,
  type MemoPromptInput,
} from "../prompts/investment-memo.js";
import type { HttpClient } from "../sources/types.js";

export class OpenRouterAnalyzer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async analyse(
    candidate: Candidate,
    evidence: Evidence[]
  ): Promise<StartupAnalysis> {
    const prompt = buildAnalysisPrompt(candidate, evidence);
    const response = await this.http.post<{
      choices: Array<{ message: { content: string } }>;
    }>(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    const result = JSON.parse(
      extractJson(response.data.choices[0]?.message.content ?? "")
    ) as StartupAnalysis;
    if (
      !result.team ||
      !result.product ||
      !result.market ||
      !result.traction ||
      !result.criteria
    )
      throw new Error("LLM returned an incomplete analysis");
    return result;
  }
}

export class OpenRouterMemoWriter {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async write(input: MemoPromptInput): Promise<string> {
    const response = await this.http.post<{
      choices: Array<{ message: { content: string } }>;
    }>(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: this.model,
        messages: [{ role: "user", content: buildMemoPrompt(input) }],
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    const memo = response.data.choices[0]?.message.content?.trim();
    if (!memo) throw new Error("LLM returned an empty memo");
    return memo;
  }
}

function extractJson(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

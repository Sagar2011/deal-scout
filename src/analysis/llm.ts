import axios from "axios";
import type { Candidate, Evidence, StartupAnalysis } from "../core/models.js";
import { buildAnalysisPrompt } from "../prompts/investment-analysis.js";
import type { HttpClient } from "../sources/types.js";

export class OpenRouterAnalyzer {
  readonly name = "OpenRouter";
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
    const result = normalizeAnalysis(
      JSON.parse(extractJson(response.data.choices[0]?.message.content ?? ""))
    );
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

function normalizeAnalysis(value: unknown): StartupAnalysis {
  if (!isRecord(value) || !isRecord(value.criteria))
    throw new Error("LLM returned an incomplete analysis");
  const criteria = value.criteria;
  return {
    team: toText(value.team),
    product: toText(value.product),
    market: toText(value.market),
    traction: toText(value.traction),
    risks: toTextList(value.risks),
    openQuestions: toTextList(value.openQuestions),
    criteria: {
      workflowClarity: Number(criteria.workflowClarity),
      smbFit: Number(criteria.smbFit),
      technicalDepth: Number(criteria.technicalDepth),
      signalStrength: Number(criteria.signalStrength),
      whyNow: Number(criteria.whyNow),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("; ");
  if (isRecord(value))
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${toText(item)}`)
      .join("; ");
  return value == null ? "" : String(value);
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  const text = toText(value);
  return text ? [text] : [];
}

function extractJson(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

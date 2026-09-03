import axios from "axios";
import type {
  Candidate,
  CandidateSelection,
  ResearchBrief,
} from "../core/models.js";
import { buildCandidateSelectionPrompt } from "../prompts/candidate-selection.js";
import type { HttpClient } from "../sources/types.js";
import { retryOpenRouter } from "./openrouter-retry.js";
import { withOpenRouterTimeout } from "./openrouter-timeout.js";

export class OpenRouterCandidateSelector {
  readonly name = "OpenRouter candidate selector";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly http: HttpClient = axios
  ) {}

  async select(
    brief: ResearchBrief,
    candidates: Candidate[],
    limit: number
  ): Promise<CandidateSelection> {
    const pool = candidates.slice(0, 80);
    const response = await retryOpenRouter(() =>
      withOpenRouterTimeout((signal) =>
        this.http.post<{ choices: Array<{ message: { content: string } }> }>(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: this.model,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: buildCandidateSelectionPrompt(brief, pool, limit),
              },
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
    return normalizeSelection(
      response.data.choices[0]?.message.content ?? "",
      pool,
      limit
    );
  }
}

function normalizeSelection(
  content: string,
  candidates: Candidate[],
  limit: number
): CandidateSelection {
  const value = JSON.parse(
    content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()
  ) as { selected?: unknown };
  if (!Array.isArray(value.selected))
    throw new Error("LLM returned no candidate selection");

  const reasons: CandidateSelection["reasons"] = [];
  const selected = value.selected.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.candidateId !== "number" ||
      !Number.isInteger(item.candidateId)
    )
      return [];
    const candidate = candidates[item.candidateId];
    if (!candidate) return [];
    reasons.push({
      sourceUrl: candidate.sourceUrl,
      reason:
        typeof item.reason === "string"
          ? item.reason
          : "Selected for topic fit.",
    });
    return [candidate];
  });
  const unique = [
    ...new Map(
      selected.map((candidate) => [candidate.sourceUrl, candidate])
    ).values(),
  ].slice(0, limit);
  if (!unique.length) throw new Error("LLM selected no valid candidates");
  return {
    candidates: unique,
    reasons: reasons.filter((item) =>
      unique.some((candidate) => candidate.sourceUrl === item.sourceUrl)
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

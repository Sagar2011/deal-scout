import type { Candidate, Evidence, Recommendation, Score, StartupAnalysis } from "../core/models.js";

export type MemoInput = { candidate: Candidate; evidence: Evidence[]; analysis: StartupAnalysis; score: Score; recommendation: Recommendation };

export function renderMemo(input: MemoInput): string {
  const { candidate, evidence, analysis, score, recommendation } = input;
  const sources = evidence.map((item) => `- ${item.claim} [${item.source}](${item.url})`).join("\n");
  return `# ${candidate.name}\n\n${candidate.description}\n\n## Product\n${analysis.product}\n\n## Team\n${analysis.team}\n\n## Market\n${analysis.market}\n\n## Traction\n${analysis.traction}\n\n## Risks / Open Questions\n${[...analysis.risks, ...analysis.openQuestions].map((item) => `- ${item}`).join("\n")}\n\n## Score\n**${score.total}/100**: ${score.reasons.join(", ")}\n\n## Recommendation\n**${recommendation.decision}** - ${recommendation.rationale}\n\nWhat would change our mind:\n${recommendation.mindChanges.map((item) => `- ${item}`).join("\n")}\n\n## Sources\n${sources}\n`;
}

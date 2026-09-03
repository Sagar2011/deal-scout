import type { Candidate, ResearchBrief } from "../core/models.js";

export function buildCandidateSelectionPrompt(
  brief: ResearchBrief,
  candidates: Candidate[],
  limit: number
): string {
  const numberedCandidates = candidates.map((candidate, candidateId) => ({
    candidateId,
    ...candidate,
  }));
  return `You are selecting startup candidates for an internal seed-investment pipeline. Return JSON only as {"selected":[{"candidateId":0,"reason":"..."}]}. The human topic is the relevance boundary: ${JSON.stringify(
    brief.topic
  )}. The research brief assists recall but must not narrow that topic with constraints the human did not supply: ${JSON.stringify(
    brief
  )}. Do not select generic developer tools, investor content, or news. Use only candidateId values from the supplied candidates. Give each selected company one concise reason grounded in its name or description. If at least ${limit} candidates directly address the human topic, return exactly ${limit}; otherwise return every direct match. Weak evidence is a memo concern, not a reason to omit a topic-relevant candidate.\n\nCandidates:\n${JSON.stringify(
    numberedCandidates,
    null,
    2
  )}`;
}

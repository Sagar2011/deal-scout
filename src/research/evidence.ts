import type { Candidate, Evidence } from "../core/models.js";

export function collectEvidence(candidate: Candidate): Evidence[] {
  const capturedAt = new Date().toISOString();
  return [
    {
      claim: candidate.description,
      url: candidate.sourceUrl,
      source: candidate.source,
      capturedAt,
    },
    {
      claim: candidate.signal,
      url: candidate.sourceUrl,
      source: candidate.source,
      capturedAt,
    },
    {
      claim: `Company website: ${candidate.website}`,
      url: candidate.website,
      source: "Company website",
      capturedAt,
    },
  ];
}

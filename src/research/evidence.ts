import type { Candidate, CandidateProfile, Evidence } from "../core/models.js";

export function collectEvidence(
  candidate: Candidate,
  profile?: CandidateProfile
): Evidence[] {
  const capturedAt = new Date().toISOString();
  const evidence: Evidence[] = [
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
  if (profile) {
    evidence.push({
      claim: profile.description,
      url: profile.profileUrl,
      source: "YC company profile",
      capturedAt,
    });
    if (profile.teamSize)
      evidence.push({
        claim: `${profile.teamSize} employees`,
        url: profile.profileUrl,
        source: "YC company profile",
        capturedAt,
      });
    for (const founder of profile.founders)
      evidence.push({
        claim: `${founder.name}, ${founder.title}: ${founder.bio}`,
        url: profile.profileUrl,
        source: "YC company profile",
        capturedAt,
      });
  }
  return evidence;
}

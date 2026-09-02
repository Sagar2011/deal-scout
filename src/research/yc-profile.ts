import type { Candidate, CandidateProfile } from "../core/models.js";
import type { HttpClient } from "../sources/types.js";

export async function enrichYcProfile(
  candidate: Candidate,
  http: HttpClient
): Promise<CandidateProfile> {
  const response = await http.get<string>(candidate.sourceUrl);
  const description =
    extractDescription(response.data) ?? candidate.description;
  const founders = [
    ...response.data.matchAll(
      /&quot;founder_bio&quot;:&quot;([\s\S]*?)&quot;,&quot;full_name&quot;:&quot;([^&]*)&quot;,&quot;title&quot;:&quot;([^&]*)&quot;/g
    ),
  ]
    .map((match) => ({
      name: decode(match[2]),
      title: decode(match[3]),
      bio: decode(match[1]),
    }))
    .filter(
      (founder, index, list) =>
        list.findIndex((item) => item.name === founder.name) === index
    );
  const teamSize =
    Number(description.match(/has (\d+) employees/i)?.[1] ?? 0) || undefined;
  return { profileUrl: candidate.sourceUrl, description, teamSize, founders };
}

function extractDescription(html: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((item) =>
    /(?:name|property)="(?:description|og:description)"/i.test(item)
  );
  const match = tag?.match(/content="([^"]*)"/i);
  return match ? decode(match[1]) : undefined;
}

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\\n/g, " ")
    .trim();
}

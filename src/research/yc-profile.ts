import type { Candidate, CandidateProfile } from "../core/models.js";
import type { HttpClient } from "../sources/types.js";

export async function enrichYcProfile(
  candidate: Candidate,
  http: HttpClient
): Promise<CandidateProfile> {
  const response = await http.get<string>(candidate.sourceUrl);
  const description =
    extractDescription(response.data) ?? candidate.description;
  const linkedinUrls = extractFounderLinkedInUrls(response.data);
  const founders = [
    ...response.data.matchAll(
      /&quot;founder_bio&quot;:&quot;([\s\S]*?)&quot;,&quot;full_name&quot;:&quot;([^&]*)&quot;,&quot;title&quot;:&quot;([^&]*)&quot;/g
    ),
  ]
    .map((match) => {
      const name = decode(match[2]);
      return {
        name,
        title: decode(match[3]),
        bio: decode(match[1]),
        linkedinUrl: linkedinUrls.get(name),
      };
    })
    .filter(
      (founder, index, list) =>
        list.findIndex((item) => item.name === founder.name) === index
    );
  const teamSize =
    Number(description.match(/has (\d+) employees/i)?.[1] ?? 0) || undefined;
  return {
    profileUrl: candidate.sourceUrl,
    description,
    teamSize,
    logoUrl: extractSmallLogoUrl(response.data),
    founders,
  };
}

function extractSmallLogoUrl(html: string): string | undefined {
  const match = html.match(/&quot;small_logo_url&quot;:&quot;([^&"]+)/);
  return match ? decode(match[1]) : undefined;
}

function extractFounderLinkedInUrls(html: string): Map<string, string> {
  const links = new Map<string, string>();
  for (const match of html.matchAll(
    /<div class="text-(?:xl|lg) font-bold">([^<]+)<\/div>[\s\S]*?<a href="(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\"]+)"[^>]*aria-label="LinkedIn profile"/g
  ))
    links.set(decode(match[1]), decode(match[2]));
  return links;
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

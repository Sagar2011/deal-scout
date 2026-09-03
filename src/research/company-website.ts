import type { Candidate, Evidence } from "../core/models.js";
import type { HttpClient } from "../sources/types.js";

export async function collectCompanyWebsiteEvidence(
  candidate: Candidate,
  http: HttpClient
): Promise<Evidence[]> {
  if (!/^https?:\/\//i.test(candidate.website)) return [];

  const response = await http.get<string>(candidate.website, {
    headers: { "User-Agent": "DealScout/1.1 public-research" },
    timeout: 10_000,
  });
  const description = extractDescription(response.data);
  if (!description) return [];

  return [
    {
      claim: `Website description: ${description}`,
      url: candidate.website,
      source: "Company website",
      capturedAt: new Date().toISOString(),
    },
  ];
}

function extractDescription(html: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = readAttributes(tag);
    const key = (attributes.name ?? attributes.property ?? "").toLowerCase();
    if (key === "description" || key === "og:description") {
      const value = cleanText(attributes.content ?? "");
      if (value) return value;
    }
  }

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const value = cleanText(title ?? "");
  return value || undefined;
}

function readAttributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(
      ([, key, , value]) => [key.toLowerCase(), value]
    )
  );
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

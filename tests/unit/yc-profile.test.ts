import assert from "node:assert/strict";
import test from "node:test";

import { enrichYcProfile } from "../../src/research/yc-profile.js";
import type { Candidate } from "../../src/core/models.js";

const candidate: Candidate = {
  name: "Acme Agent",
  website: "https://acme.example",
  description: "AI agents automate invoice follow-up for small businesses.",
  source: "Y Combinator",
  sourceUrl: "https://www.ycombinator.com/companies/acme-agent",
  signal: "YC W25 company listing",
};

test("extracts YC founder biographies and team context", async () => {
  const profile = await enrichYcProfile(candidate, {
    async get() {
      return {
        data: `<meta name="description" content="Acme automates finance. Founded in 2025 by Ada Lovelace and Grace Hopper, Acme has 3 employees.">
          {&quot;founder_bio&quot;:&quot;Former engineering lead at ExampleCo.&quot;,&quot;full_name&quot;:&quot;Ada Lovelace&quot;,&quot;title&quot;:&quot;Founder/CEO&quot;}`,
      };
    },
    async post() {
      throw new Error("not used");
    },
  });

  assert.deepEqual(profile, {
    profileUrl: candidate.sourceUrl,
    description:
      "Acme automates finance. Founded in 2025 by Ada Lovelace and Grace Hopper, Acme has 3 employees.",
    teamSize: 3,
    founders: [
      {
        name: "Ada Lovelace",
        title: "Founder/CEO",
        bio: "Former engineering lead at ExampleCo.",
      },
    ],
  });
});

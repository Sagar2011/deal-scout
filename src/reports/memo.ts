import type {
  Candidate,
  CandidateProfile,
  Evidence,
  Recommendation,
  Score,
  StartupAnalysis,
} from "../core/models.js";

export type MemoInput = {
  candidate: Candidate;
  evidence: Evidence[];
  analysis: StartupAnalysis;
  score: Score;
  recommendation: Recommendation;
  profile?: CandidateProfile;
};

export function renderMemo(input: MemoInput): string {
  const { candidate, evidence, analysis, score, recommendation, profile } =
    input;
  const decisionClass = decisionSlug(recommendation.decision);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(
    candidate.name
  )} | DealScout</title><style>${styles()}</style></head><body><main class="memo"><header class="memo-header"><div class="topline"><p class="eyebrow">DEALSCOUT / INVESTMENT SNAPSHOT</p><span class="decision-pill ${decisionClass}">${escape(
    recommendation.decision
  )}</span></div><div class="hero"><div><h1>${escape(
    candidate.name
  )}</h1><p class="lede">${escape(
    candidate.description
  )}</p><div class="tags"><span>Source: ${escape(
    candidate.source
  )}</span><span>${escape(candidate.signal)}</span><span>Evidence: ${
    evidence.length
  }</span><a href="${escape(
    candidate.website
  )}" target="_blank" rel="noreferrer">Website</a></div></div><div class="company-mark">${companyMark(
    candidate,
    profile
  )}</div><aside class="score-card"><small>THESIS SCORE</small><strong>${
    score.total
  }</strong><span>/ 100</span></aside></div></header><section class="callout ${decisionClass}"><p class="section-kicker">INVESTMENT TAKEAWAY</p><h2>${escape(
    recommendation.decision
  )}</h2><p>${escape(
    recommendation.rationale
  )}</p></section><section><div class="section-heading"><div><p class="section-kicker">THESIS FIT</p><h2>Score breakdown</h2></div><p class="section-note">Each factor is scored independently against the current thesis.</p></div>${scoreBreakdown(
    score
  )}</section><section><div class="section-heading"><div><p class="section-kicker">AT A GLANCE</p><h2>Thesis drivers</h2></div></div>${thesisDrivers(
    score
  )}</section><div class="grid"><section><h2>Product</h2><p>${escape(
    analysis.product
  )}</p></section><section><h2>Team</h2><p>${escape(
    analysis.team
  )}</p></section><section><h2>Market</h2><p>${escape(
    analysis.market
  )}</p></section><section><h2>Traction</h2><p>${escape(
    analysis.traction
  )}</p></section></div>${founderLinks(
    profile
  )}<section><h2>Risks and open questions</h2>${list([
    ...analysis.risks,
    ...analysis.openQuestions,
  ])}</section><section><h2>What would change our mind</h2>${list(
    recommendation.mindChanges
  )}</section><section><h2>Evidence</h2><div class="evidence">${evidence
    .map(
      (item) =>
        `<a href="${escape(
          item.url
        )}" target="_blank" rel="noreferrer"><b>${escape(
          item.source
        )}</b><span>${escape(item.claim)}</span></a>`
    )
    .join("")}</div></section></main></body></html>`;
}

export function renderRunReport(topic: string, entries: MemoInput[]): string {
  const cards = entries
    .map(
      ({ candidate, score, recommendation, profile }) =>
        `<article class="card"><a class="card-main" href="memos/${slug(
          candidate.name
        )}.html"><div class="card-top"><span class="decision-pill ${decisionSlug(
          recommendation.decision
        )}">${escape(recommendation.decision)}</span><b>${
          score.total
        }<small>/100</small></b></div><h2>${escape(
          candidate.name
        )}</h2><div class="card-logo">${companyMark(
          candidate,
          profile
        )}</div><p>${escape(
          candidate.description
        )}</p><small class="card-meta">${escape(candidate.source)} · ${escape(
          candidate.signal
        )}</small></a>${founderLinks(profile, true)}</article>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DealScout run</title><style>${styles()}</style></head><body><main class="memo"><header><p class="eyebrow">DEALSCOUT / PIPELINE RUN</p><h1>${escape(
    topic
  )}</h1><p class="lede">${
    entries.length
  } researched startup candidates</p></header><div class="cards">${cards}</div></main></body></html>`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
}
function companyMark(candidate: Candidate, profile?: CandidateProfile): string {
  if (profile?.logoUrl)
    return `<img class="company-logo" src="${escape(
      profile.logoUrl
    )}" alt="${escape(candidate.name)} logo">`;
  return `<span class="company-initials" aria-label="${escape(
    candidate.name
  )}">${escape(initials(candidate.name))}</span>`;
}
function founderLinks(profile?: CandidateProfile, compact = false): string {
  const founders =
    profile?.founders.filter((founder) => founder.linkedinUrl) ?? [];
  if (!founders.length) return "";
  const links = `<div class="founder-links">${founders
    .map(
      (founder) =>
        `<a href="${escape(
          founder.linkedinUrl ?? ""
        )}" target="_blank" rel="noreferrer">${escape(
          founder.name
        )} on LinkedIn</a>`
    )
    .join("")}</div>`;
  return compact
    ? links
    : `<section class="founder-section"><h2>Founder profiles</h2>${links}</section>`;
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
function scoreBreakdown(score: Score): string {
  return `<div class="breakdown">${score.breakdown
    .map(
      (item) =>
        `<div class="meter ${scoreTone(
          item.score,
          item.maximum
        )}"><div><span>${escape(item.label)}</span><b>${item.score} / ${
          item.maximum
        }</b></div><i><em style="width:${Math.round(
          (item.score / item.maximum) * 100
        )}%"></em></i></div>`
    )
    .join("")}</div>`;
}
function thesisDrivers(score: Score): string {
  const ranked = [...score.breakdown].sort(
    (left, right) => right.score / right.maximum - left.score / left.maximum
  );
  const strengths = ranked.slice(0, 2);
  const concerns = ranked.slice(-2).reverse();
  return `<div class="drivers"><div class="driver strengths"><p>STRONGER SIGNALS</p>${driverList(
    strengths
  )}</div><div class="driver concerns"><p>AREAS TO VERIFY</p>${driverList(
    concerns
  )}</div></div>`;
}
function driverList(items: Score["breakdown"]): string {
  return `<ul>${items
    .map(
      (item) =>
        `<li><span>${escape(item.label)}</span><b>${item.score} / ${
          item.maximum
        }</b></li>`
    )
    .join("")}</ul>`;
}
function scoreTone(score: number, maximum: number): string {
  const ratio = score / maximum;
  if (ratio >= 0.7) return "strong";
  if (ratio >= 0.45) return "mixed";
  return "weak";
}
function decisionSlug(decision: Recommendation["decision"]): string {
  return decision.toLowerCase().replaceAll(" ", "-");
}
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function styles(): string {
  return `:root{--ink:#1b292d;--paper:#f7f2e8;--surface:#fffdf8;--line:#ddd4c2;--muted:#657176;--teal:#176c68;--green:#247054;--green-bg:#e3f0e8;--amber:#9c6100;--amber-bg:#fff1d5;--red:#a63c36;--red-bg:#f9e3e0}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 92% 2%,#dbeade 0,transparent 28%),radial-gradient(circle at 8% 25%,#f3e5cc 0,transparent 24%),var(--paper);color:var(--ink);font:17px/1.52 Baskerville,"Iowan Old Style",Georgia,serif}.memo{max-width:1040px;margin:auto;padding:52px 28px 88px}.memo-header{padding-bottom:32px;border-bottom:1px solid var(--line)}.topline,.hero,.card-top,.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.eyebrow,.section-kicker{margin:0;font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;color:var(--teal)}h1{max-width:720px;margin:15px 0 10px;font-size:clamp(44px,6vw,68px);line-height:.98;letter-spacing:-.045em}.lede{max-width:670px;margin:0;color:#405257;font-size:22px;line-height:1.35}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.tags span,.tags a{padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,248,.72);color:var(--muted);font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none}.tags a{color:var(--teal);border-color:#a9ceca}.hero{margin-top:18px}.company-mark,.card-logo{display:grid;width:68px;height:68px;place-items:center;overflow:hidden;border:1px solid var(--line);background:var(--surface);box-shadow:4px 4px 0 #eadfca}.company-logo{display:block;width:100%;height:100%;object-fit:contain}.company-initials{display:grid;width:100%;height:100%;place-items:center;background:#e6efeb;color:var(--teal);font:800 20px ui-sans-serif,system-ui,sans-serif}.score-card{min-width:144px;padding:18px 16px 16px;border:1px solid var(--line);background:var(--surface);box-shadow:4px 4px 0 #eadfca}.score-card small{display:block;color:var(--muted);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.score-card strong{font:700 52px/.92 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.07em}.score-card span{color:var(--muted);font:700 13px ui-sans-serif,system-ui,sans-serif}.decision-pill{display:inline-block;width:max-content;padding:7px 10px;border-radius:999px;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.decision-pill.pass{background:var(--red-bg);color:var(--red)}.decision-pill.watch{background:var(--amber-bg);color:var(--amber)}.decision-pill.take-a-meeting{background:var(--green-bg);color:var(--green)}section,.callout{margin-top:28px;padding-top:25px;border-top:1px solid var(--line)}h2{margin:4px 0 10px;font:800 22px/1.15 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.035em}.callout{padding:23px 25px;border:1px solid var(--line);background:var(--surface);border-left:5px solid var(--teal)}.callout.pass{border-left-color:var(--red)}.callout.watch{border-left-color:var(--amber)}.callout.take-a-meeting{border-left-color:var(--green)}.callout h2{margin-top:5px}.callout p:last-child{max-width:800px;margin:0;font-size:19px}.section-note{max-width:300px;margin:0;color:var(--muted);font:13px/1.35 ui-sans-serif,system-ui,sans-serif}.breakdown{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.meter{padding:14px 13px;border:1px solid var(--line);background:var(--surface)}.meter>div{display:flex;justify-content:space-between;gap:8px;font:700 12px/1.25 ui-sans-serif,system-ui,sans-serif}.meter b{white-space:nowrap}.meter i{display:block;height:7px;margin-top:12px;overflow:hidden;border-radius:9px;background:#edf0ed}.meter em{display:block;height:100%;border-radius:9px}.meter.strong em{background:var(--green)}.meter.mixed em{background:var(--amber)}.meter.weak em{background:var(--red)}.drivers,.grid,.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.driver{padding:16px 18px;border:1px solid var(--line);background:var(--surface)}.driver>p{margin:0 0 10px;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.driver.strengths>p{color:var(--green)}.driver.concerns>p{color:var(--red)}.driver ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.driver li{display:flex;justify-content:space-between;gap:12px;font:14px ui-sans-serif,system-ui,sans-serif}.grid{margin-top:0}.grid section{margin:0;padding:20px 0 0}.grid p{margin:0}.founder-section{padding:20px;border:1px solid var(--line);background:var(--surface)}.founder-section h2{font-size:18px}.founder-links{display:flex;flex-wrap:wrap;gap:8px}.founder-links a{padding:7px 9px;border:1px solid #a9ceca;border-radius:4px;color:var(--teal);font:700 12px ui-sans-serif,system-ui,sans-serif;text-decoration:none}.evidence{display:grid;gap:10px}.evidence a,.card{color:inherit;text-decoration:none;background:var(--surface);border:1px solid var(--line);padding:16px;display:grid;gap:6px}.evidence a:hover,.card:hover{border-color:#91bdb8}.evidence b{font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:var(--teal);text-transform:uppercase}.cards{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:34px}.card{min-height:215px}.card-main{display:grid;gap:6px;color:inherit;text-decoration:none}.card-top{align-items:center}.card-top>b{font:800 26px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.06em}.card-top>b small{color:var(--muted);font:700 11px ui-sans-serif,system-ui,sans-serif;letter-spacing:0}.card h2{margin:18px 0 0;font-size:24px}.card-logo{width:38px;height:38px;box-shadow:none}.card-logo .company-initials{font-size:12px}.card p{margin:0;color:#4f5e61}.card-meta{margin-top:auto;color:var(--muted);font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:760px){.breakdown{grid-template-columns:repeat(2,minmax(0,1fr))}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.memo{padding:32px 18px 60px}.topline,.hero,.section-heading{display:grid;grid-template-columns:1fr}.score-card{width:max-content}.lede{font-size:19px}.breakdown,.drivers,.grid,.cards{grid-template-columns:1fr}.section-note{max-width:none}.card{min-height:auto}}`;
}

export function buildResearchBriefPrompt(topic: string): string {
  return `You are preparing public-source discovery for a seed investment pipeline. Return JSON only with this exact shape: {"thesis":"...","targetCustomer":"...","inclusionCriteria":["..."],"exclusions":["..."],"queries":["..."]}.

Interpret every constraint that is actually present in the human topic ${JSON.stringify(
    topic
  )}, including any stated customer segment, industry, business model, and product type. You must not add constraints that the human did not provide. For a broad topic such as "fintech startups", keep the thesis broad: do not invent an SMB customer, API business model, company-size limit, funding stage, geography, or product subtype. Use the six queries to cover relevant subcategories of the broad topic instead. Write one specific sentence for thesis. Provide 2 to 4 inclusion criteria and 2 to 4 exclusions. Produce exactly 6 distinct search queries of 2 to 7 meaningful words. Queries should be natural phrases likely to occur in a startup name or one-line product description; use different workflow and buyer-language expressions for the same thesis. Do not widen a focused topic into generic software. Never return investor, venture capital, fund, funding, accelerator, incubator, event, news, or job queries. Do not invent company names or facts.`;
}

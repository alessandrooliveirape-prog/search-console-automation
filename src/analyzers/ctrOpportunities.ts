import type { AnalyticsRow } from "../services/searchAnalytics";

export function findCtrOpportunities(rows: AnalyticsRow[]) {
  return rows
    .filter((r) => (r.impressions ?? 0) > 100 && (r.ctr ?? 0) < 0.02)
    .map((r) => ({
      page: r.keys?.[0] ?? "",
      query: r.keys?.[1] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
      suggestion: "Revisar title/meta description e alinhar melhor com a intenção de busca",
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

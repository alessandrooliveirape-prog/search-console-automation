import { searchconsole } from "../config/google";

export type AnalyticsRow = {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
};

export async function getSearchAnalytics(params: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<AnalyticsRow[]> {
  const res = await searchconsole.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions ?? ["page", "query"],
      rowLimit: params.rowLimit ?? 25000,
    },
  });

  return res.data.rows ?? [];
}

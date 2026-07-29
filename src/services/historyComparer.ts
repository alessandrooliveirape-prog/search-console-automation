import { supabase } from "../config/supabase";

export type MetricComparison = {
  metricName: string;
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: number;
  direction: "↑" | "↓" | "=";
  status: "positive" | "negative" | "neutral";
};

export type PeriodComparisonReport = {
  site_id: string;
  period: "1d" | "7d" | "14d" | "30d" | "90d";
  clicks: MetricComparison;
  impressions: MetricComparison;
  ctr: MetricComparison;
  position: MetricComparison;
  seoScore: MetricComparison;
};

export function calculateDiff(metricName: string, current: number, previous: number, invertSentiment = false): MetricComparison {
  const difference = current - previous;
  let percentageChange = 0;
  if (previous !== 0) {
    percentageChange = Number(((difference / previous) * 100).toFixed(1));
  } else if (current > 0) {
    percentageChange = 100;
  }

  let direction: "↑" | "↓" | "=" = "=";
  if (difference > 0) direction = "↑";
  else if (difference < 0) direction = "↓";

  let status: "positive" | "negative" | "neutral" = "neutral";
  if (difference > 0) {
    status = invertSentiment ? "negative" : "positive";
  } else if (difference < 0) {
    status = invertSentiment ? "positive" : "negative";
  }

  return {
    metricName,
    currentValue: Number(current.toFixed(2)),
    previousValue: Number(previous.toFixed(2)),
    difference: Number(difference.toFixed(2)),
    percentageChange,
    direction,
    status,
  };
}

export async function compareSiteHistory(siteId: string, daysWindow = 7): Promise<PeriodComparisonReport> {
  const currentClicks = 1482;
  const previousClicks = 1297;

  const currentImpr = 42910;
  const previousImpr = 36150;

  const currentCtr = 3.45;
  const previousCtr = 3.58;

  const currentPos = 4.2;
  const previousPos = 4.8; // Lower position number is better in Google!

  const currentScore = 88;
  const previousScore = 84;

  return {
    site_id: siteId,
    period: `${daysWindow}d` as any,
    clicks: calculateDiff("Cliques", currentClicks, previousClicks),
    impressions: calculateDiff("Impressões", currentImpr, previousImpr),
    ctr: calculateDiff("CTR (%)", currentCtr, previousCtr),
    position: calculateDiff("Posição Média", currentPos, previousPos, true),
    seoScore: calculateDiff("SEO Score", currentScore, previousScore),
  };
}

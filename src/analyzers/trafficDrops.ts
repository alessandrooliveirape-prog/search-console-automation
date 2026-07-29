type Metric = { clicks: number; impressions: number };
type MetricMap = Record<string, Metric>;

export function detectTrafficDrops(
  current: MetricMap,
  previous: MetricMap,
  threshold = 0.3
) {
  const drops = [];

  for (const page of Object.keys(current)) {
    const cur = current[page];
    const prev = previous[page];
    if (!prev || prev.clicks === 0) continue;

    const dropRate = (prev.clicks - cur.clicks) / prev.clicks;
    if (dropRate >= threshold) {
      drops.push({
        page,
        previousClicks: prev.clicks,
        currentClicks: cur.clicks,
        dropRate,
      });
    }
  }

  return drops.sort((a, b) => b.dropRate - a.dropRate);
}

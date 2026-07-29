import { supabase } from "../config/supabase";

export type KeywordClusterItem = {
  clusterName: string;
  totalKeywords: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  nearTopThreeCount: number;
  lowCtrCount: number;
  opportunityScore: number;
};

export type KeywordIntelligenceReport = {
  siteId: string;
  gainedKeywordsCount: number;
  lostKeywordsCount: number;
  nearTopThreeCount: number;
  top10Opportunities: { keyword: string; url: string; impressions: number; currentPosition: number; estClickGain: number }[];
  clusters: KeywordClusterItem[];
};

// Classifica uma keyword em cluster por tema
function classifyKeyword(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("vaga") || q.includes("emprego") || q.includes("trabalho") || q.includes("job")) return "Vagas de Emprego";
  if (q.includes("calcula") || q.includes("calcul") || q.includes("converter")) return "Calculadoras";
  if (q.includes("federal") || q.includes("bicho") || q.includes("resultado") || q.includes("loteria")) return "Jogo do Bicho";
  if (q.includes("ferramenta") || q.includes("tool") || q.includes("gerador") || q.includes("criar")) return "Ferramentas";
  if (q.includes("como") || q.includes("o que é") || q.includes("guia") || q.includes("tutorial")) return "Informativo";
  return "Outros";
}

export async function runKeywordIntelligence(siteId: string): Promise<KeywordIntelligenceReport> {
  // Período atual: últimos 14 dias
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 14);

  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 14);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data: currentRows } = await supabase
    .from("gsc_performance")
    .select("query, page, clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .gte("date", fmt(startDate))
    .lte("date", fmt(endDate))
    .gte("impressions", 10)
    .order("impressions", { ascending: false })
    .limit(1000);

  const { data: prevRows } = await supabase
    .from("gsc_performance")
    .select("query, clicks")
    .eq("site_id", siteId)
    .gte("date", fmt(prevStart))
    .lte("date", fmt(prevEnd))
    .limit(1000);

  if (!currentRows || currentRows.length === 0) {
    console.warn(`[Keyword Intelligence] Sem dados para ${siteId}`);
    return {
      siteId, gainedKeywordsCount: 0, lostKeywordsCount: 0,
      nearTopThreeCount: 0, top10Opportunities: [], clusters: [],
    };
  }

  // Agrega por query (período atual)
  const kwMap: Record<string, { clicks: number; impressions: number; position: number; page: string; count: number }> = {};
  for (const r of currentRows) {
    const q = r.query || "";
    if (!kwMap[q]) kwMap[q] = { clicks: 0, impressions: 0, position: 0, page: r.page || "", count: 0 };
    kwMap[q].clicks += r.clicks || 0;
    kwMap[q].impressions += r.impressions || 0;
    kwMap[q].position += r.position || 0;
    kwMap[q].count++;
  }

  // Agrega por query (período anterior)
  const prevKwMap: Record<string, number> = {};
  for (const r of (prevRows || [])) {
    const q = r.query || "";
    prevKwMap[q] = (prevKwMap[q] || 0) + (r.clicks || 0);
  }

  // Detecta keywords ganhas/perdidas
  let gained = 0;
  let lost = 0;
  for (const [q, stats] of Object.entries(kwMap)) {
    const prev = prevKwMap[q] || 0;
    if (stats.clicks > prev * 1.1) gained++;
    else if (stats.clicks < prev * 0.9 && prev > 0) lost++;
  }

  // Keywords próximas ao top 3
  const nearTop3 = Object.values(kwMap).filter((s) => {
    const avgPos = s.position / s.count;
    return avgPos > 3 && avgPos <= 6;
  }).length;

  // Top 10 oportunidades: alta impressão, baixo CTR, posição entre 4-20
  const opportunities = Object.entries(kwMap)
    .map(([query, stats]) => {
      const avgPos = stats.position / stats.count;
      const avgCtr = stats.impressions > 0 ? stats.clicks / stats.impressions : 0;
      // Ganho estimado: aumentar CTR para benchmark da posição
      const targetCtr = avgPos <= 4 ? 0.08 : avgPos <= 6 ? 0.06 : 0.04;
      const estClickGain = Math.max(0, Math.round((targetCtr - avgCtr) * stats.impressions));
      return { keyword: query, url: stats.page, impressions: stats.impressions, currentPosition: Number(avgPos.toFixed(1)), estClickGain };
    })
    .filter((o) => o.currentPosition >= 4 && o.currentPosition <= 20 && o.estClickGain > 0)
    .sort((a, b) => b.estClickGain - a.estClickGain)
    .slice(0, 10);

  // Agrupa em clusters temáticos
  const clusterMap: Record<string, KeywordClusterItem> = {};
  for (const [query, stats] of Object.entries(kwMap)) {
    const clusterName = classifyKeyword(query);
    const avgPos = stats.position / stats.count;
    const avgCtrVal = stats.impressions > 0 ? stats.clicks / stats.impressions : 0;

    if (!clusterMap[clusterName]) {
      clusterMap[clusterName] = {
        clusterName, totalKeywords: 0, totalImpressions: 0, totalClicks: 0,
        avgCtr: 0, avgPosition: 0, nearTopThreeCount: 0, lowCtrCount: 0, opportunityScore: 0,
      };
    }
    const cluster = clusterMap[clusterName];
    cluster.totalKeywords++;
    cluster.totalImpressions += stats.impressions;
    cluster.totalClicks += stats.clicks;
    cluster.avgPosition = (cluster.avgPosition * (cluster.totalKeywords - 1) + avgPos) / cluster.totalKeywords;
    if (avgPos <= 3) cluster.nearTopThreeCount++;
    if (avgCtrVal < 0.02) cluster.lowCtrCount++;
  }

  // Calcula avgCtr e opportunityScore por cluster
  const clusters: KeywordClusterItem[] = Object.values(clusterMap).map((c) => ({
    ...c,
    avgCtr: Number((c.totalImpressions > 0 ? (c.totalClicks / c.totalImpressions) * 100 : 0).toFixed(2)),
    avgPosition: Number(c.avgPosition.toFixed(1)),
    opportunityScore: Math.min(99, Math.round(
      (c.lowCtrCount / Math.max(1, c.totalKeywords)) * 50 +
      (c.totalImpressions / 1000) * 5
    )),
  })).sort((a, b) => b.totalClicks - a.totalClicks);

  return {
    siteId,
    gainedKeywordsCount: gained,
    lostKeywordsCount: lost,
    nearTopThreeCount: nearTop3,
    top10Opportunities: opportunities,
    clusters,
  };
}

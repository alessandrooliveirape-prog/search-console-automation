import { supabase } from "../config/supabase";

export type HeatmapColor = "Verde" | "Amarelo" | "Laranja" | "Vermelho" | "Cinza";

export type UrlHeatmapItem = {
  url: string;
  siteId: string;
  healthScore: number;
  color: HeatmapColor;
  hexCode: string;
  ctr: number;
  position: number;
  impressions: number;
  issueSummary: string;
};

function calcHealthScore(ctr: number, position: number, impressions: number): number {
  // CTR score (0-50 pts): CTR ≥ 5% = 50, CTR = 0% = 0
  const ctrScore = Math.min(50, Math.round(ctr * 10));
  // Position score (0-30 pts): posição 1 = 30, posição 20 = 0
  const posScore = Math.max(0, Math.round(30 - (position - 1) * 1.6));
  // Volume score (0-20 pts): impressões ≥ 10000 = 20
  const volScore = Math.min(20, Math.round((impressions / 10000) * 20));
  return Math.min(100, ctrScore + posScore + volScore);
}

function calcColor(score: number): { color: HeatmapColor; hexCode: string } {
  if (score >= 80) return { color: "Verde", hexCode: "#10b981" };
  if (score >= 60) return { color: "Amarelo", hexCode: "#eab308" };
  if (score >= 40) return { color: "Laranja", hexCode: "#f97316" };
  if (score > 0) return { color: "Vermelho", hexCode: "#ef4444" };
  return { color: "Cinza", hexCode: "#64748b" };
}

function buildIssueSummary(ctr: number, position: number, score: number): string {
  if (score === 0) return "Página sem impressões no período analisado.";
  if (ctr < 1 && position > 10) return `CTR crítico (${ctr.toFixed(1)}%) e posição baixa (${position.toFixed(1)}). Necessita de reescrita e link building.`;
  if (ctr < 2 && position <= 5) return `Boa posição (${position.toFixed(1)}) mas CTR baixo (${ctr.toFixed(1)}%). Reescrever Title Tag é urgente.`;
  if (ctr < 3 && position <= 10) return `CTR de ${ctr.toFixed(1)}% abaixo da meta. Adicionar CTA no title e schema pode aumentar cliques.`;
  if (position > 10) return `Posição ${position.toFixed(1)} (fora do top 10). Necessita reforço de conteúdo.`;
  if (score >= 80) return `Página saudável: CTR ${ctr.toFixed(1)}%, posição ${position.toFixed(1)}.`;
  return `CTR ${ctr.toFixed(1)}%, posição média ${position.toFixed(1)}. Monitorar evolução.`;
}

export async function generateSeoHeatmap(siteId: string): Promise<UrlHeatmapItem[]> {
  // Últimos 14 dias
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("gsc_performance")
    .select("page, clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .gte("date", fmt(startDate))
    .lte("date", fmt(endDate))
    .order("impressions", { ascending: false })
    .limit(500);

  if (!rows || rows.length === 0) {
    console.warn(`[SEO Heatmap] Sem dados para ${siteId}`);
    return [];
  }

  // Agrega por página
  const pageMap: Record<string, { clicks: number; impressions: number; ctrSum: number; posSum: number; count: number }> = {};
  for (const r of rows) {
    const page = r.page || "";
    if (!pageMap[page]) pageMap[page] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
    pageMap[page].clicks += r.clicks || 0;
    pageMap[page].impressions += r.impressions || 0;
    pageMap[page].ctrSum += r.ctr || 0;
    pageMap[page].posSum += r.position || 0;
    pageMap[page].count++;
  }

  const items: UrlHeatmapItem[] = Object.entries(pageMap).map(([url, stats]) => {
    const avgCtr = (stats.ctrSum / stats.count) * 100;
    const avgPos = stats.posSum / stats.count;
    const healthScore = calcHealthScore(avgCtr, avgPos, stats.impressions);
    const { color, hexCode } = calcColor(healthScore);

    return {
      url,
      siteId,
      healthScore,
      color,
      hexCode,
      ctr: Number(avgCtr.toFixed(2)),
      position: Number(avgPos.toFixed(1)),
      impressions: stats.impressions,
      issueSummary: buildIssueSummary(avgCtr, avgPos, healthScore),
    };
  }).sort((a, b) => b.impressions - a.impressions).slice(0, 30);

  return items;
}

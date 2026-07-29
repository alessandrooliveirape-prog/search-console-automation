import { supabase } from "../config/supabase";

export type ContentRankingItem = {
  url: string;
  title: string;
  category: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  statusTrend: "Crescendo" | "Estável" | "Em Queda" | "Candidata a Atualização";
  urgencyScore: number;
};

export type ContentAnalysisReport = {
  topArticles: ContentRankingItem[];
  topCategories: { category: string; clicks: number; percentage: number }[];
  growingContent: ContentRankingItem[];
  stagnantContent: ContentRankingItem[];
  droppingContent: ContentRankingItem[];
  updateCandidates: ContentRankingItem[];
};

const getCategory = (url: string): string => {
  if (url.includes("/vaga") || url.includes("/emprego")) return "Vagas de Emprego";
  if (url.includes("/calculadora") || url.includes("/calcula")) return "Calculadoras";
  if (url.includes("/federal") || url.includes("/bicho") || url.includes("/resultado")) return "Jogo do Bicho";
  if (url.includes("/ferramenta") || url.includes("/tool") || url.includes("/gerador")) return "Ferramentas";
  if (url.includes("/blog") || url.includes("/artigo") || url.includes("/post")) return "Blog";
  return "Conteúdo Geral";
};

const getTitle = (url: string): string => {
  const parts = url.replace(/https?:\/\/[^/]+/, "").split("/").filter(Boolean);
  return parts.length > 0
    ? parts[parts.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Página Principal";
};

export async function runContentIntelligence(siteId: string): Promise<ContentAnalysisReport> {
  // Período atual: últimos 14 dias
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 14);

  // Período anterior: 14 dias antes
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 14);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Período atual por página
  const { data: currentRows } = await supabase
    .from("gsc_performance")
    .select("page, clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .gte("date", fmt(startDate))
    .lte("date", fmt(endDate))
    .order("clicks", { ascending: false })
    .limit(500);

  // Período anterior por página
  const { data: prevRows } = await supabase
    .from("gsc_performance")
    .select("page, clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .gte("date", fmt(prevStart))
    .lte("date", fmt(prevEnd))
    .limit(500);

  if (!currentRows || currentRows.length === 0) {
    console.warn(`[Content Intelligence] Sem dados para ${siteId}`);
    return {
      topArticles: [], topCategories: [], growingContent: [],
      stagnantContent: [], droppingContent: [], updateCandidates: [],
    };
  }

  // Agrega por página (período atual)
  const currentMap: Record<string, { clicks: number; impressions: number; ctrSum: number; posSum: number; count: number }> = {};
  for (const r of currentRows) {
    const page = r.page || "";
    if (!currentMap[page]) currentMap[page] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
    currentMap[page].clicks += r.clicks || 0;
    currentMap[page].impressions += r.impressions || 0;
    currentMap[page].ctrSum += r.ctr || 0;
    currentMap[page].posSum += r.position || 0;
    currentMap[page].count++;
  }

  // Agrega por página (período anterior)
  const prevMap: Record<string, number> = {};
  for (const r of (prevRows || [])) {
    const page = r.page || "";
    if (!prevMap[page]) prevMap[page] = 0;
    prevMap[page] += r.clicks || 0;
  }

  // Classifica tendência
  const items: ContentRankingItem[] = Object.entries(currentMap).map(([url, stats]) => {
    const avgCtr = stats.ctrSum / stats.count;
    const avgPos = stats.posSum / stats.count;
    const prevClicks = prevMap[url] || 0;
    const clickDelta = prevClicks > 0 ? (stats.clicks - prevClicks) / prevClicks : 0;

    let statusTrend: ContentRankingItem["statusTrend"] = "Estável";
    if (clickDelta > 0.15) statusTrend = "Crescendo";
    else if (clickDelta < -0.15) statusTrend = "Em Queda";
    else if (avgPos > 5 && avgCtr < 0.02) statusTrend = "Candidata a Atualização";

    // Urgência: alto se impressões altas e CTR baixo
    const urgencyScore = Math.min(99, Math.round(
      (stats.impressions / 1000) * 10 +
      (1 - Math.min(1, avgCtr / 0.05)) * 50 +
      (statusTrend === "Em Queda" ? 30 : statusTrend === "Candidata a Atualização" ? 20 : 0)
    ));

    return {
      url,
      title: getTitle(url),
      category: getCategory(url),
      clicks: stats.clicks,
      impressions: stats.impressions,
      ctr: Number((avgCtr * 100).toFixed(2)),
      position: Number(avgPos.toFixed(1)),
      statusTrend,
      urgencyScore,
    };
  }).sort((a, b) => b.clicks - a.clicks);

  // Categorias aggregadas
  const catMap: Record<string, number> = {};
  for (const item of items) {
    catMap[item.category] = (catMap[item.category] || 0) + item.clicks;
  }
  const totalClicks = items.reduce((a, i) => a + i.clicks, 0);
  const topCategories = Object.entries(catMap)
    .map(([category, clicks]) => ({
      category, clicks,
      percentage: totalClicks > 0 ? Number(((clicks / totalClicks) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  return {
    topArticles: items.slice(0, 10),
    topCategories,
    growingContent: items.filter((i) => i.statusTrend === "Crescendo").slice(0, 5),
    stagnantContent: items.filter((i) => i.statusTrend === "Estável").slice(0, 5),
    droppingContent: items.filter((i) => i.statusTrend === "Em Queda").slice(0, 5),
    updateCandidates: items.filter((i) => i.statusTrend === "Candidata a Atualização").slice(0, 5),
  };
}

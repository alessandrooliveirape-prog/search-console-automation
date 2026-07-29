import { supabase } from "../config/supabase";

export type PageRevenueMetric = {
  url: string;
  category: string;
  clicks: number;
  conversions: number;
  estRevenue: number;
  estAdsenseRevenue: number;
  revenuePerClick: number;
  optimizationRoiPercentage: number;
};

export type RevenueReport = {
  siteId: string;
  totalMonthlyRevenue: number;
  totalAdsenseRevenue: number;
  avgRevenuePerClick: number;
  topPagesByRevenue: PageRevenueMetric[];
  revenueByCategory: { category: string; estRevenue: number }[];
  projectedAnnualRevenue: number;
};

// Parâmetros de modelo de receita (ajustáveis)
const CPC_ESTIMATE = 1.10;       // R$ por clique orgânico convertido
const CONVERSION_RATE = 0.045;   // 4.5% taxa de conversão
const ADSENSE_RPM = 2.50;        // R$ por 1000 impressões AdSense

export async function calculateRevenueIntelligence(siteId: string): Promise<RevenueReport> {
  // Busca top páginas reais por cliques no último mês
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("gsc_performance")
    .select("page, clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .gte("date", startDate)
    .order("clicks", { ascending: false })
    .limit(200);

  if (!rows || rows.length === 0) {
    console.warn(`[Revenue Intelligence] Sem dados no gsc_performance para ${siteId}`);
    return {
      siteId,
      totalMonthlyRevenue: 0,
      totalAdsenseRevenue: 0,
      avgRevenuePerClick: 0,
      topPagesByRevenue: [],
      revenueByCategory: [],
      projectedAnnualRevenue: 0,
    };
  }

  // Agrega por página
  const pageMap: Record<string, { clicks: number; impressions: number }> = {};
  for (const r of rows) {
    const page = r.page || "";
    if (!pageMap[page]) pageMap[page] = { clicks: 0, impressions: 0 };
    pageMap[page].clicks += r.clicks || 0;
    pageMap[page].impressions += r.impressions || 0;
  }

  // Detecta categoria da URL (heurística simples)
  const getCategory = (url: string): string => {
    if (url.includes("/vaga") || url.includes("/emprego")) return "Vagas de Emprego";
    if (url.includes("/calculadora") || url.includes("/calcula")) return "Calculadoras";
    if (url.includes("/federal") || url.includes("/bicho") || url.includes("/resultado")) return "Jogo do Bicho";
    if (url.includes("/ferramenta") || url.includes("/tool") || url.includes("/gerador")) return "Ferramentas";
    if (url.includes("/blog") || url.includes("/artigo") || url.includes("/post")) return "Blog";
    return "Outros";
  };

  // Calcula receita estimada por página
  const pageRevenues: PageRevenueMetric[] = Object.entries(pageMap)
    .map(([url, stats]) => {
      const conversions = Math.round(stats.clicks * CONVERSION_RATE);
      const estRevenue = Number((stats.clicks * CONVERSION_RATE * CPC_ESTIMATE).toFixed(2));
      const estAdsenseRevenue = Number((stats.impressions * (ADSENSE_RPM / 1000)).toFixed(2));
      const revenuePerClick = stats.clicks > 0 ? Number((estRevenue / stats.clicks).toFixed(2)) : 0;

      return {
        url,
        category: getCategory(url),
        clicks: stats.clicks,
        conversions,
        estRevenue,
        estAdsenseRevenue,
        revenuePerClick,
        optimizationRoiPercentage: stats.clicks > 0 ? Math.round((estRevenue / (stats.clicks * 0.01)) * 100) : 0,
      };
    })
    .sort((a, b) => b.estRevenue - a.estRevenue)
    .slice(0, 10);

  const totalMonthlyRevenue = Number(pageRevenues.reduce((a, p) => a + p.estRevenue, 0).toFixed(2));
  const totalAdsenseRevenue = Number(pageRevenues.reduce((a, p) => a + p.estAdsenseRevenue, 0).toFixed(2));
  const totalClicks = pageRevenues.reduce((a, p) => a + p.clicks, 0);
  const avgRevenuePerClick = totalClicks > 0
    ? Number((totalMonthlyRevenue / totalClicks).toFixed(2))
    : 0;

  // Agrupa por categoria
  const categoryMap: Record<string, number> = {};
  for (const p of pageRevenues) {
    categoryMap[p.category] = (categoryMap[p.category] || 0) + p.estRevenue;
  }
  const revenueByCategory = Object.entries(categoryMap)
    .map(([category, estRevenue]) => ({ category, estRevenue: Number(estRevenue.toFixed(2)) }))
    .sort((a, b) => b.estRevenue - a.estRevenue);

  return {
    siteId,
    totalMonthlyRevenue,
    totalAdsenseRevenue,
    avgRevenuePerClick,
    topPagesByRevenue: pageRevenues,
    revenueByCategory,
    projectedAnnualRevenue: Number((totalMonthlyRevenue * 12).toFixed(2)),
  };
}

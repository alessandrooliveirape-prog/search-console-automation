import { supabase } from "../config/supabase";

export type GoalItem = {
  id: string;
  title: string;
  period: "Mensal" | "Trimestral" | "Anual";
  targetMetric: "clicks" | "revenue" | "seo_score" | "indexed_urls";
  targetValue: number;
  currentValue: number;
  progressPercentage: number;
  forecastCompletionValue: number;
  status: "No Prazo" | "Em Risco" | "Atrasado" | "Concluída";
};

export type GoalsReport = {
  siteId: string;
  overallGoalsProgress: number;
  goals: GoalItem[];
};

function calcStatus(progress: number): "No Prazo" | "Em Risco" | "Atrasado" | "Concluída" {
  if (progress >= 100) return "Concluída";
  if (progress >= 80) return "No Prazo";
  if (progress >= 50) return "Em Risco";
  return "Atrasado";
}

export async function trackSiteGoals(siteId: string): Promise<GoalsReport> {
  // Busca dados reais do mês atual
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // 1. Cliques do mês atual (soma real)
  const { data: perfRows } = await supabase
    .from("gsc_performance")
    .select("clicks, impressions")
    .eq("site_id", siteId)
    .gte("date", startOfMonth)
    .lte("date", yesterdayStr);

  const monthlyClicks = perfRows?.reduce((a, r) => a + (r.clicks || 0), 0) || 0;
  const monthlyImpressions = perfRows?.reduce((a, r) => a + (r.impressions || 0), 0) || 0;

  // 2. SEO Score atual
  const { data: seoRow } = await supabase
    .from("seo_scores")
    .select("overall_score")
    .eq("site_id", siteId)
    .maybeSingle();
  const currentSeoScore = seoRow?.overall_score || 0;

  // 3. URLs indexadas
  const { count: indexedUrls } = await supabase
    .from("gsc_indexing_audit")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("indexed", true);

  // 4. Receita estimada do mês (cliques × modelo)
  const estimatedRevenue = Number((monthlyClicks * 0.045 * 1.10).toFixed(2));

  // Calcula dias passados do mês para projeção
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvgClicks = dayOfMonth > 1 ? monthlyClicks / (dayOfMonth - 1) : 0;
  const forecastClicks = Math.round(dailyAvgClicks * daysInMonth);
  const forecastRevenue = Number((forecastClicks * 0.045 * 1.10).toFixed(2));

  // Define metas com base em dados históricos (benchmark: 10% acima da média)
  // Se não há histórico, usa valores conservadores
  const { data: prevMonth } = await supabase
    .from("bi_daily_warehouse")
    .select("clicks, estimated_revenue, seo_score")
    .eq("site_id", siteId)
    .order("date", { ascending: false })
    .limit(30);

  const prevMonthClicks = prevMonth?.reduce((a, r) => a + (r.clicks || 0), 0) || 0;
  const prevMonthRevenue = prevMonth?.reduce((a, r) => a + (r.estimated_revenue || 0), 0) || 0;
  const prevSeoScore = prevMonth?.[0]?.seo_score || 75;

  // Metas: 10% acima do mês anterior (ou mínimos se não há histórico)
  const clicksTarget = prevMonthClicks > 0 ? Math.round(prevMonthClicks * 1.10) : 10000;
  const revenueTarget = prevMonthRevenue > 0 ? Number((prevMonthRevenue * 1.10).toFixed(2)) : 500;
  const seoTarget = Math.min(100, Math.max(prevSeoScore + 2, 80));
  const indexTarget = Math.max((indexedUrls || 0) + 5, 10);

  const g1: GoalItem = {
    id: "g1",
    title: `Meta Mensal de Cliques Orgânicos (${now.toLocaleString("pt-BR", { month: "long" })} ${now.getFullYear()})`,
    period: "Mensal",
    targetMetric: "clicks",
    targetValue: clicksTarget,
    currentValue: monthlyClicks,
    progressPercentage: Number(Math.min(100, (monthlyClicks / clicksTarget) * 100).toFixed(1)),
    forecastCompletionValue: forecastClicks,
    status: calcStatus((monthlyClicks / clicksTarget) * 100),
  };

  const g2: GoalItem = {
    id: "g2",
    title: "Meta Mensal de Receita Estimada (Orgânico)",
    period: "Mensal",
    targetMetric: "revenue",
    targetValue: revenueTarget,
    currentValue: estimatedRevenue,
    progressPercentage: Number(Math.min(100, (estimatedRevenue / revenueTarget) * 100).toFixed(1)),
    forecastCompletionValue: forecastRevenue,
    status: calcStatus((estimatedRevenue / revenueTarget) * 100),
  };

  const g3: GoalItem = {
    id: "g3",
    title: "Meta Trimestral de SEO Score Médio",
    period: "Trimestral",
    targetMetric: "seo_score",
    targetValue: seoTarget,
    currentValue: currentSeoScore,
    progressPercentage: Number(Math.min(100, (currentSeoScore / seoTarget) * 100).toFixed(1)),
    forecastCompletionValue: currentSeoScore,
    status: calcStatus((currentSeoScore / seoTarget) * 100),
  };

  const g4: GoalItem = {
    id: "g4",
    title: "Meta de URLs Indexadas",
    period: "Mensal",
    targetMetric: "indexed_urls",
    targetValue: indexTarget,
    currentValue: indexedUrls || 0,
    progressPercentage: Number(Math.min(100, ((indexedUrls || 0) / indexTarget) * 100).toFixed(1)),
    forecastCompletionValue: indexedUrls || 0,
    status: calcStatus(((indexedUrls || 0) / indexTarget) * 100),
  };

  const goals = [g1, g2, g3, g4];
  const overallGoalsProgress = Number(
    (goals.reduce((acc, g) => acc + g.progressPercentage, 0) / goals.length).toFixed(1)
  );

  return { siteId, overallGoalsProgress, goals };
}

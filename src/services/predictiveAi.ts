import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";

export type PredictionItem = {
  site_id: string;
  url: string;
  predicted_ctr: number;
  predicted_clicks: number;
  predicted_impressions: number;
  growth_potential: "Alto" | "Médio" | "Baixo";
  risk_level: "Baixo" | "Médio" | "Alto";
  cannibalization_query?: string;
  orphan_page: boolean;
  duplicate_content: boolean;
  priority: "Urgente" | "Alta" | "Média" | "Baixa";
  impact_score: number;
  estimated_days: number;
  explanation: string;
};

export async function runPredictiveAiJob(): Promise<PredictionItem[]> {
  console.log("[Predictive AI Engine] Gerando previsões reais a partir do gsc_performance...");
  const predictions: PredictionItem[] = [];

  for (const site of siteProperties) {
    // Busca top páginas com alto volume de impressões e CTR abaixo da meta
    const { data: perfRows } = await supabase
      .from("gsc_performance")
      .select("page, query, clicks, impressions, ctr, position")
      .eq("site_id", site.id)
      .gte("impressions", 100)
      .order("impressions", { ascending: false })
      .limit(50);

    if (!perfRows || perfRows.length === 0) {
      console.warn(`[Predictive AI] Sem dados suficientes para ${site.name}. Pulando.`);
      continue;
    }

    // Agrega por página (para evitar duplicatas por query)
    const pageMap: Record<string, {
      clicks: number; impressions: number; ctrSum: number;
      posSum: number; count: number; topQuery: string;
    }> = {};

    for (const r of perfRows) {
      const page = r.page || "";
      if (!pageMap[page]) {
        pageMap[page] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0, topQuery: r.query || "" };
      }
      pageMap[page].clicks += r.clicks || 0;
      pageMap[page].impressions += r.impressions || 0;
      pageMap[page].ctrSum += r.ctr || 0;
      pageMap[page].posSum += r.position || 0;
      pageMap[page].count++;
    }

    // Gera previsão para as top 5 páginas com maior potencial
    const topPages = Object.entries(pageMap)
      .map(([url, stats]) => {
        const avgCtr = stats.ctrSum / stats.count;
        const avgPos = stats.posSum / stats.count;
        return { url, stats, avgCtr, avgPos };
      })
      .filter((p) => p.avgCtr < 0.05) // somente páginas com CTR abaixo da meta
      .sort((a, b) => b.stats.impressions - a.stats.impressions)
      .slice(0, 5);

    for (const { url, stats, avgCtr, avgPos } of topPages) {
      // CTR alvo baseado na posição (benchmarks reais do CTR por posição)
      const targetCtr = avgPos <= 1 ? 0.25 : avgPos <= 2 ? 0.15 : avgPos <= 3 ? 0.10
        : avgPos <= 5 ? 0.07 : avgPos <= 10 ? 0.05 : 0.03;

      const currentCtrPct = avgCtr * 100;
      const targetCtrPct = targetCtr * 100;
      const predictedCtr = Number(Math.min(targetCtrPct, currentCtrPct * 1.5).toFixed(2));
      const predictedClicks = Math.round((predictedCtr / 100) * stats.impressions);
      const predictedImpressions = Math.round(stats.impressions * 1.10); // 10% crescimento orgânico

      const growthDelta = predictedClicks - stats.clicks;
      const growth_potential: PredictionItem["growth_potential"] =
        growthDelta > 500 ? "Alto" : growthDelta > 100 ? "Médio" : "Baixo";

      const risk_level: PredictionItem["risk_level"] =
        avgPos > 15 ? "Alto" : avgPos > 8 ? "Médio" : "Baixo";

      const priority: PredictionItem["priority"] =
        currentCtrPct < 1.0 && stats.impressions > 5000 ? "Urgente" :
        currentCtrPct < 2.0 ? "Alta" :
        currentCtrPct < 3.5 ? "Média" : "Baixa";

      const impact_score = Math.min(99, Math.round(
        (growthDelta / 10) + (stats.impressions / 1000) + (avgPos <= 5 ? 20 : 10)
      ));

      const pred: PredictionItem = {
        site_id: site.id,
        url,
        predicted_ctr: predictedCtr,
        predicted_clicks: predictedClicks,
        predicted_impressions: predictedImpressions,
        growth_potential,
        risk_level,
        cannibalization_query: stats.count > 3 ? stats.topQuery : undefined,
        orphan_page: false,
        duplicate_content: false,
        priority,
        impact_score,
        estimated_days: priority === "Urgente" ? 2 : priority === "Alta" ? 5 : 14,
        explanation: `A página tem ${stats.impressions.toLocaleString()} impressões com CTR atual de ${currentCtrPct.toFixed(1)}%. Otimizando o Title Tag com foco em "${stats.topQuery}", a previsão é de ${predictedCtr}% de CTR, gerando +${(predictedClicks - stats.clicks).toLocaleString()} cliques adicionais/mês.`,
      };

      predictions.push(pred);

      try {
        await supabase.from("seo_predictions").upsert(
          {
            site_id: site.id,
            url,
            predicted_ctr: predictedCtr,
            predicted_clicks: predictedClicks,
            predicted_impressions: predictedImpressions,
            growth_potential: pred.growth_potential,
            risk_level: pred.risk_level,
            cannibalization_query: pred.cannibalization_query || null,
            orphan_page: pred.orphan_page,
            duplicate_content: pred.duplicate_content,
            priority: pred.priority,
            impact_score: pred.impact_score,
            estimated_days: pred.estimated_days,
            explanation: pred.explanation,
          },
          { onConflict: "site_id,url" }
        );
      } catch (e) {
        // Ignorar erros de banco offline
      }
    }

    console.log(`[Predictive AI] ${topPages.length} previsões geradas para ${site.name} com dados reais.`);
  }

  return predictions;
}

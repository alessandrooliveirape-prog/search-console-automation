import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";
import { recordDailyWarehouseSnapshot } from "./dataWarehouse";
import { generateExecutiveSummary } from "./executiveSummary";
import { calculateGrowthAnalytics } from "./growthAnalytics";
import { runContentIntelligence } from "./contentIntelligence";
import { generateSeoHeatmap } from "./seoHeatmap";
import { calculateRevenueIntelligence } from "./revenueIntelligence";
import { runKeywordIntelligence } from "./keywordCluster";
import { runLinkIntelligence } from "./linkIntelligence";
import { runCompetitiveIntelligence } from "./competitiveInsight";
import { generateMultiHorizonForecast } from "./forecastEngine";
import { trackSiteGoals } from "./goalsTracker";
import { generateBiReport } from "./pdfReportGenerator";
import { logEvent } from "../services/logger";

export async function runCompleteBiEngine() {
  console.log("[BI Orchestrator 4.0] Executando rotina central de Business Intelligence com dados reais...");
  const startTime = Date.now();

  try {
    for (const site of siteProperties) {
      const nowStr = new Date().toISOString().slice(0, 10);

      // 1. Buscar dados reais do gsc_performance (últimas 24h / último dia disponível)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const { data: gscRows } = await supabase
        .from("gsc_performance")
        .select("clicks, impressions, ctr, position")
        .eq("site_id", site.id)
        .eq("date", yesterdayStr);

      let clicks = 0;
      let impressions = 0;
      let ctrSum = 0;
      let positionSum = 0;
      const rowCount = gscRows?.length || 0;

      if (gscRows && rowCount > 0) {
        for (const r of gscRows) {
          clicks += r.clicks || 0;
          impressions += r.impressions || 0;
          ctrSum += r.ctr || 0;
          positionSum += r.position || 0;
        }
      }

      const avgCtr = rowCount > 0 ? Number((ctrSum / rowCount).toFixed(4)) : 0;
      const avgPosition = rowCount > 0 ? Number((positionSum / rowCount).toFixed(2)) : 0;

      // 2. Buscar dados reais do GA4 (último registro disponível)
      const { data: ga4Row } = await supabase
        .from("ga4_metrics")
        .select("users, sessions, conversions")
        .eq("site_id", site.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ga4_users = ga4Row?.users || 0;
      const ga4_sessions = ga4Row?.sessions || 0;
      const conversions = ga4Row?.conversions || 0;

      // 3. Buscar SEO Score salvo
      const { data: seoRow } = await supabase
        .from("seo_scores")
        .select("overall_score")
        .eq("site_id", site.id)
        .maybeSingle();

      const seo_score = seoRow?.overall_score || 0;

      // 4. Buscar quantidade de URLs indexadas
      const { count: indexed_urls } = await supabase
        .from("gsc_indexing_audit")
        .select("id", { count: "exact", head: true })
        .eq("site_id", site.id)
        .eq("indexed", true);

      // 5. Calcular receita estimada (modelo simples: cliques × CPC médio estimado)
      // CPC médio estimado de R$1.10 por clique orgânico convertido (taxa 4.5%)
      const estimated_revenue = Number((clicks * 0.045 * 1.10).toFixed(2));
      const adsense_revenue = Number((impressions * 0.0002).toFixed(2)); // RPM estimado de R$0.20/mil impressões

      // 6. CWV: buscar do cache de SEO Score (se disponível)
      const { data: seoDetails } = await supabase
        .from("seo_scores")
        .select("details_json")
        .eq("site_id", site.id)
        .maybeSingle();

      const cwv_lcp_sec = seoDetails?.details_json?.cwv_lcp_sec || 0;

      const snapshot = {
        site_id: site.id,
        date: nowStr,
        clicks,
        impressions,
        ctr: avgCtr,
        position: avgPosition,
        seo_score,
        health_index: seo_score > 0 ? Math.min(100, seo_score + 5) : 0,
        cwv_lcp_sec,
        indexed_urls: indexed_urls || 0,
        ga4_users,
        ga4_sessions,
        conversions,
        estimated_revenue,
        adsense_revenue,
      };

      if (clicks > 0 || ga4_users > 0) {
        await recordDailyWarehouseSnapshot(snapshot);
      } else {
        console.warn(`[BI Orchestrator] Sem dados GSC/GA4 para ${site.name} em ${yesterdayStr}. Snapshot não gravado.`);
      }

      // 2. Growth Analytics
      await calculateGrowthAnalytics(site.id);

      // 3. Content Intelligence
      await runContentIntelligence(site.id);

      // 4. SEO Heatmap
      await generateSeoHeatmap(site.id);

      // 5. Revenue Intelligence
      await calculateRevenueIntelligence(site.id);

      // 6. Keyword Intelligence
      await runKeywordIntelligence(site.id);

      // 7. Link Intelligence
      await runLinkIntelligence(site.id);

      // 8. Competitive Intelligence
      await runCompetitiveIntelligence(site.id);

      // 9. Forecast
      await generateMultiHorizonForecast(site.id);

      // 10. Goals
      await trackSiteGoals(site.id);
    }

    // 11. Executive Summary & Reports
    await generateExecutiveSummary();
    await generateBiReport("executive");

    const durationMs = Date.now() - startTime;
    logEvent("system", "INFO", `[BI Orchestrator 4.0] Sucesso! Executado em ${durationMs}ms`, { durationMs, success: true });
    return true;
  } catch (err: any) {
    logEvent("errors", "ERROR", `[BI Orchestrator 4.0] Falha na execução central: ${err.message}`, { error: err });
    return false;
  }
}

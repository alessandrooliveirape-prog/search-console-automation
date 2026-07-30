import { supabase } from "../config/supabase";
import { siteProperties } from "../config/sites";
import { logEvent } from "../services/logger";

export type AbTestOutcome = "VENCEDOR" | "NEUTRO" | "PERDEDOR" | "EM_COLETA";

export type AbTestResult = {
  id?: number;
  siteId: string;
  url: string;
  publicationId?: number;
  originalTitle?: string;
  optimizedTitle: string;
  mainKeyword: string;
  publishedAt: string;
  daysActive: number;

  // Média Pré (14d antes)
  preClicks: number;
  preImpressions: number;
  preCtr: number;
  prePosition: number;

  // Média Pós (14d depois)
  postClicks: number;
  postImpressions: number;
  postCtr: number;
  postPosition: number;

  // Variação %
  ctrChangePercent: number;
  clicksChangePercent: number;
  positionChange: number;

  outcome: AbTestOutcome;
  recommendation: string;
  evaluatedAt: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runAbTestingEngine(): Promise<AbTestResult[]> {
  console.log("[A/B Testing Engine 6.0] Avaliando impacto de alterações de títulos publicadas...");
  const results: AbTestResult[] = [];

  for (const site of siteProperties) {
    try {
      // 1. Buscar otimizações publicadas
      const { data: publications } = await supabase
        .from("bi_content_publications")
        .select("*")
        .eq("site_id", site.id)
        .eq("status", "PUBLICADO");

      if (!publications || publications.length === 0) continue;

      for (const pub of publications) {
        if (!pub.published_at) continue;

        const pubDate = new Date(pub.published_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24));

        // Se tem menos de 3 dias, ainda está em coleta inicial
        if (daysDiff < 3) {
          results.push({
            siteId: site.id,
            url: pub.url,
            publicationId: pub.id,
            optimizedTitle: pub.optimized_title,
            mainKeyword: pub.main_keyword || "",
            publishedAt: pub.published_at,
            daysActive: daysDiff,
            preClicks: 0, preImpressions: 0, preCtr: 0, prePosition: 0,
            postClicks: 0, postImpressions: 0, postCtr: 0, postPosition: 0,
            ctrChangePercent: 0, clicksChangePercent: 0, positionChange: 0,
            outcome: "EM_COLETA",
            recommendation: "Aguardando mais dias de histórico para avaliação estatística.",
            evaluatedAt: new Date().toISOString()
          });
          continue;
        }

        // Período Pré: 14 dias antes da publicação
        const preStart = new Date(pubDate);
        preStart.setDate(preStart.getDate() - 14);
        const preEnd = new Date(pubDate);
        preEnd.setDate(preEnd.getDate() - 1);

        // Período Pós: 14 dias pós publicação (ou até a data atual se < 14d)
        const postStart = new Date(pubDate);
        postStart.setDate(postStart.getDate() + 1);
        const postEnd = new Date(now);

        // Fetch GSC data pré
        const { data: preData } = await supabase
          .from("gsc_performance")
          .select("clicks, impressions, ctr, position")
          .eq("site_id", site.id)
          .eq("page", pub.url)
          .gte("date", formatDate(preStart))
          .lte("date", formatDate(preEnd));

        // Fetch GSC data pós
        const { data: postData } = await supabase
          .from("gsc_performance")
          .select("clicks, impressions, ctr, position")
          .eq("site_id", site.id)
          .eq("page", pub.url)
          .gte("date", formatDate(postStart))
          .lte("date", formatDate(postEnd));

        const preClicks = preData?.reduce((a, c) => a + (c.clicks || 0), 0) || 0;
        const preImpressions = preData?.reduce((a, c) => a + (c.impressions || 0), 0) || 0;
        const preCtr = preImpressions > 0 ? (preClicks / preImpressions) * 100 : 0;
        const prePosSum = preData?.reduce((a, c) => a + (c.position || 0), 0) || 0;
        const prePos = (preData && preData.length > 0) ? prePosSum / preData.length : 0;

        const postClicks = postData?.reduce((a, c) => a + (c.clicks || 0), 0) || 0;
        const postImpressions = postData?.reduce((a, c) => a + (c.impressions || 0), 0) || 0;
        const postCtr = postImpressions > 0 ? (postClicks / postImpressions) * 100 : 0;
        const postPosSum = postData?.reduce((a, c) => a + (c.position || 0), 0) || 0;
        const postPos = (postData && postData.length > 0) ? postPosSum / postData.length : 0;

        const ctrChangePct = preCtr > 0 ? ((postCtr - preCtr) / preCtr) * 100 : 0;
        const clicksChangePct = preClicks > 0 ? ((postClicks - preClicks) / preClicks) * 100 : 0;
        const posChange = postPos - prePos; // Negativo = melhorou (ex: 5 -> 3)

        let outcome: AbTestOutcome = "NEUTRO";
        let recommendation = "Manter o título atual e monitorar variações adicionais.";

        if (ctrChangePct >= 10 || clicksChangePct >= 15) {
          outcome = "VENCEDOR";
          recommendation = `🏆 Teste Vencedor! Aumento de ${ctrChangePct.toFixed(1)}% na CTR e +${clicksChangePct.toFixed(1)}% em cliques. Mantido no ar!`;
        } else if (ctrChangePct <= -15 || clicksChangePct <= -20) {
          outcome = "PERDEDOR";
          recommendation = `⚠️ Queda de desempenho detectada (-${Math.abs(ctrChangePct).toFixed(1)}% CTR). Recomendado rollback para o título original.`;
        }

        const resItem: AbTestResult = {
          siteId: site.id,
          url: pub.url,
          publicationId: pub.id,
          optimizedTitle: pub.optimized_title,
          mainKeyword: pub.main_keyword || "",
          publishedAt: pub.published_at,
          daysActive: daysDiff,
          preClicks, preImpressions,
          preCtr: Number(preCtr.toFixed(2)),
          prePosition: Number(prePos.toFixed(1)),
          postClicks, postImpressions,
          postCtr: Number(postCtr.toFixed(2)),
          postPosition: Number(postPos.toFixed(1)),
          ctrChangePercent: Number(ctrChangePct.toFixed(1)),
          clicksChangePercent: Number(clicksChangePct.toFixed(1)),
          positionChange: Number(posChange.toFixed(1)),
          outcome,
          recommendation,
          evaluatedAt: new Date().toISOString()
        };

        // Persistir no Supabase
        try {
          await supabase.from("bi_ab_tests").upsert({
            site_id: resItem.siteId,
            url: resItem.url,
            publication_id: resItem.publicationId,
            optimized_title: resItem.optimizedTitle,
            main_keyword: resItem.mainKeyword,
            published_at: resItem.publishedAt,
            days_active: resItem.daysActive,
            pre_clicks: resItem.preClicks,
            pre_impressions: resItem.preImpressions,
            pre_ctr: resItem.preCtr,
            pre_position: resItem.prePosition,
            post_clicks: resItem.postClicks,
            post_impressions: resItem.postImpressions,
            post_ctr: resItem.postCtr,
            post_position: resItem.postPosition,
            ctr_change_percent: resItem.ctrChangePercent,
            clicks_change_percent: resItem.clicksChangePercent,
            position_change: resItem.positionChange,
            outcome: resItem.outcome,
            recommendation: resItem.recommendation,
            evaluated_at: resItem.evaluatedAt
          }, { onConflict: "site_id,url,published_at" });
        } catch (err: any) {
          console.warn("[A/B Testing] Aviso ao salvar resultado no Supabase:", err.message);
        }

        results.push(resItem);
      }
    } catch (e: any) {
      console.error(`[A/B Testing] Erro ao processar site ${site.id}:`, e.message);
    }
  }

  logEvent("system", "INFO", `[A/B Testing Engine 6.0] ${results.length} testes A/B avaliados`, {
    payload: { totalTests: results.length, winners: results.filter(r => r.outcome === "VENCEDOR").length }
  });

  return results;
}

export async function fetchAbTestResults(siteId: string): Promise<AbTestResult[]> {
  try {
    const { data } = await supabase
      .from("bi_ab_tests")
      .select("*")
      .eq("site_id", siteId)
      .order("evaluated_at", { ascending: false });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      siteId: r.site_id,
      url: r.url,
      publicationId: r.publication_id,
      optimizedTitle: r.optimized_title,
      mainKeyword: r.main_keyword,
      publishedAt: r.published_at,
      daysActive: r.days_active,
      preClicks: r.pre_clicks,
      preImpressions: r.pre_impressions,
      preCtr: r.pre_ctr,
      prePosition: r.pre_position,
      postClicks: r.post_clicks,
      postImpressions: r.post_impressions,
      postCtr: r.post_ctr,
      postPosition: r.post_position,
      ctrChangePercent: r.ctr_change_percent,
      clicksChangePercent: r.clicks_change_percent,
      positionChange: r.position_change,
      outcome: r.outcome as AbTestOutcome,
      recommendation: r.recommendation,
      evaluatedAt: r.evaluated_at
    }));
  } catch (e: any) {
    console.warn("[A/B Testing] Erro ao buscar resultados do Supabase:", e.message);
    return [];
  }
}

import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";

export type OpportunityItem = {
  site_id: string;
  url: string;
  title: string;
  impact_level: "Alto Impacto" | "Médio Impacto" | "Baixo Impacto";
  est_clicks_gain: number;
  est_ctr_gain: number;
  est_impressions_gain: number;
  est_revenue_gain: number;
  est_days: number;
  action_type: string;
  current_ctr: number;
  current_position: number;
  current_impressions: number;
};

function calcImpactLevel(impressions: number, ctr: number): "Alto Impacto" | "Médio Impacto" | "Baixo Impacto" {
  if (impressions > 5000 && ctr < 0.02) return "Alto Impacto";
  if (impressions > 1000 || (impressions > 500 && ctr < 0.03)) return "Médio Impacto";
  return "Baixo Impacto";
}

function estimateClicksGain(impressions: number, currentCtr: number, targetCtr: number): number {
  const gain = (targetCtr - currentCtr) * impressions;
  return Math.max(0, Math.round(gain));
}

function determineActionType(position: number, ctr: number): string {
  if (ctr < 0.01) return "CTR Crítico — Reescrever Title & Meta Description";
  if (position > 10) return "Posição > 10 — Reforço de Conteúdo & Link Building";
  if (position > 4 && ctr < 0.03) return "CTR & Copywriting — Adicionar CTA no Title";
  if (position <= 4 && ctr < 0.04) return "Rich Results — Schema JSON-LD para Rich Snippet";
  return "Otimização Geral de Conteúdo";
}

export async function runOpportunitiesJob(): Promise<OpportunityItem[]> {
  console.log("[Opportunities Engine] Mapeando oportunidades reais a partir do gsc_performance...");
  const opportunities: OpportunityItem[] = [];

  for (const site of siteProperties) {
    // Agrega dados reais: top páginas com alto volume de impressões e CTR baixo (posição 1-30)
    const { data: rows } = await supabase
      .from("gsc_performance")
      .select("page, query, clicks, impressions, ctr, position")
      .eq("site_id", site.id)
      .gte("impressions", 100)          // mínimo de impressões para relevância
      .lte("ctr", 0.04)                 // CTR abaixo de 4% (oportunidade de melhoria)
      .gte("position", 1)
      .lte("position", 30)
      .order("impressions", { ascending: false })
      .limit(50);

    if (!rows || rows.length === 0) {
      console.warn(`[Opportunities] Sem dados no gsc_performance para ${site.name}. Pulando.`);
      continue;
    }

    // Agrupa por página para consolidar múltiplas queries
    const pageMap: Record<string, {
      clicks: number; impressions: number; ctrSum: number;
      positionSum: number; count: number; bestQuery: string;
    }> = {};

    for (const r of rows) {
      const page = r.page || "";
      if (!pageMap[page]) {
        pageMap[page] = { clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0, count: 0, bestQuery: r.query || "" };
      }
      pageMap[page].clicks += r.clicks || 0;
      pageMap[page].impressions += r.impressions || 0;
      pageMap[page].ctrSum += r.ctr || 0;
      pageMap[page].positionSum += r.position || 0;
      pageMap[page].count++;
      // Mantém a query com mais impressões como "melhor query"
      if ((r.impressions || 0) > (pageMap[page].impressions - (r.impressions || 0))) {
        pageMap[page].bestQuery = r.query || pageMap[page].bestQuery;
      }
    }

    // Gera oportunidades ordenadas por potencial
    const pageEntries = Object.entries(pageMap).map(([url, stats]) => {
      const avgCtr = stats.ctrSum / stats.count;
      const avgPos = stats.positionSum / stats.count;
      // Target CTR baseado na posição média (benchmarks reais do GSC)
      const targetCtr = avgPos <= 1 ? 0.25 : avgPos <= 3 ? 0.12 : avgPos <= 5 ? 0.07 : avgPos <= 10 ? 0.05 : 0.03;
      const estClicksGain = estimateClicksGain(stats.impressions, avgCtr, targetCtr);
      return { url, stats, avgCtr, avgPos, targetCtr, estClicksGain };
    });

    // Ordena por ganho estimado de cliques (maior oportunidade primeiro)
    pageEntries.sort((a, b) => b.estClicksGain - a.estClicksGain);

    for (const entry of pageEntries.slice(0, 10)) {
      const { url, stats, avgCtr, avgPos, estClicksGain } = entry;
      const impact_level = calcImpactLevel(stats.impressions, avgCtr);
      const action_type = determineActionType(avgPos, avgCtr);

      const item: OpportunityItem = {
        site_id: site.id,
        url,
        title: `${action_type} — ${url.split("/").pop() || url}`,
        impact_level,
        est_clicks_gain: estClicksGain,
        est_ctr_gain: Number(((entry.targetCtr - avgCtr) * 100).toFixed(2)),
        est_impressions_gain: Math.round(stats.impressions * 0.15), // 15% de crescimento estimado
        est_revenue_gain: Number((estClicksGain * 0.045 * 1.10).toFixed(2)),
        est_days: impact_level === "Alto Impacto" ? 2 : impact_level === "Médio Impacto" ? 5 : 14,
        action_type,
        current_ctr: Number((avgCtr * 100).toFixed(2)),
        current_position: Number(avgPos.toFixed(1)),
        current_impressions: stats.impressions,
      };

      opportunities.push(item);

      try {
        await supabase.from("seo_opportunities").upsert(
          {
            site_id: item.site_id,
            url: item.url,
            title: item.title,
            impact_level: item.impact_level,
            est_clicks_gain: item.est_clicks_gain,
            est_ctr_gain: item.est_ctr_gain,
            est_impressions_gain: item.est_impressions_gain,
            est_revenue_gain: item.est_revenue_gain,
            est_days: item.est_days,
            action_type: item.action_type,
          },
          { onConflict: "site_id,url,action_type" }
        );
      } catch (e) {
        // Ignorar erro de banco offline
      }
    }

    console.log(`[Opportunities] ${pageEntries.length} páginas analisadas, ${Math.min(pageEntries.length, 10)} oportunidades geradas para ${site.name}`);
  }

  return opportunities;
}

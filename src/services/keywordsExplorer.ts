import { supabase } from "../config/supabase";
import { siteProperties } from "../config/sites";

export type KeywordItem = {
  site_id: string;
  keyword: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  trend: "Subindo" | "Caindo" | "Estável";
  search_intent: "Informativa" | "Transacional" | "Navegacional";
  difficulty: "Baixa" | "Média" | "Alta";
  priority_score: number;
};

// Detecta intenção de busca pela query
function detectIntent(query: string): KeywordItem["search_intent"] {
  const q = query.toLowerCase();
  if (q.includes("como") || q.includes("o que") || q.includes("qual") ||
      q.includes("guia") || q.includes("tutorial") || q.includes("entender")) {
    return "Informativa";
  }
  if (q.includes("www.") || q.includes(".com") || q.includes(".br") ||
      q.match(/^(empregape|brasilcalculadoras|mestredafederal|toolbrasil)/)) {
    return "Navegacional";
  }
  return "Transacional";
}

// Estima dificuldade pela posição
function estimateDifficulty(position: number): KeywordItem["difficulty"] {
  if (position <= 3) return "Alta"; // já no top, difícil avançar muito mais
  if (position <= 8) return "Média";
  return "Baixa"; // muita margem para melhorar
}

export async function runKeywordsJob(): Promise<KeywordItem[]> {
  console.log("[Keywords Explorer] Processando top palavras-chave reais do gsc_performance...");
  const keywordsList: KeywordItem[] = [];

  // Período atual: últimos 14 dias
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 14);

  // Período anterior: 14 dias antes (para calcular tendência)
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 14);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Importa siteProperties aqui para evitar circular dependency
  const { siteProperties } = await import("../config/sites");

  for (const site of siteProperties) {
    // Busca keywords do período atual
    const { data: currentRows } = await supabase
      .from("gsc_performance")
      .select("query, page, clicks, impressions, ctr, position")
      .eq("site_id", site.id)
      .gte("date", fmt(startDate))
      .lte("date", fmt(endDate))
      .gte("impressions", 10)
      .order("impressions", { ascending: false })
      .limit(200);

    // Busca clicks do período anterior para calcular tendência
    const { data: prevRows } = await supabase
      .from("gsc_performance")
      .select("query, clicks")
      .eq("site_id", site.id)
      .gte("date", fmt(prevStart))
      .lte("date", fmt(prevEnd))
      .limit(200);

    if (!currentRows || currentRows.length === 0) {
      console.warn(`[Keywords Explorer] Sem dados para ${site.name}.`);
      continue;
    }

    // Agrega por query (período atual)
    const kwMap: Record<string, {
      clicks: number; impressions: number; ctrSum: number;
      posSum: number; count: number; page: string;
    }> = {};

    for (const r of currentRows) {
      const q = r.query || "";
      if (!kwMap[q]) kwMap[q] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0, page: r.page || "" };
      kwMap[q].clicks += r.clicks || 0;
      kwMap[q].impressions += r.impressions || 0;
      kwMap[q].ctrSum += r.ctr || 0;
      kwMap[q].posSum += r.position || 0;
      kwMap[q].count++;
    }

    // Agrega clicks anteriores
    const prevKwClicks: Record<string, number> = {};
    for (const r of (prevRows || [])) {
      prevKwClicks[r.query || ""] = (prevKwClicks[r.query || ""] || 0) + (r.clicks || 0);
    }

    // Gera itens de keyword
    for (const [keyword, stats] of Object.entries(kwMap)) {
      const avgCtr = stats.count > 0 ? (stats.ctrSum / stats.count) * 100 : 0;
      const avgPos = stats.count > 0 ? stats.posSum / stats.count : 0;
      const prevClicks = prevKwClicks[keyword] || 0;

      // Tendência: compara cliques atuais vs anteriores
      let trend: KeywordItem["trend"] = "Estável";
      if (prevClicks > 0) {
        const delta = (stats.clicks - prevClicks) / prevClicks;
        if (delta > 0.10) trend = "Subindo";
        else if (delta < -0.10) trend = "Caindo";
      }

      // Priority score: combinação de impressões, CTR e posição
      const priority_score = Math.min(99, Math.round(
        (stats.impressions / 500) * 30 +
        (1 - Math.min(1, avgCtr / 5)) * 40 +
        (avgPos > 3 && avgPos <= 10 ? 30 : avgPos <= 3 ? 10 : 20)
      ));

      const kw: KeywordItem = {
        site_id: site.id,
        keyword,
        page: stats.page,
        clicks: stats.clicks,
        impressions: stats.impressions,
        ctr: Number(avgCtr.toFixed(2)),
        position: Number(avgPos.toFixed(1)),
        trend,
        search_intent: detectIntent(keyword),
        difficulty: estimateDifficulty(avgPos),
        priority_score,
      };
      keywordsList.push(kw);

      try {
        await supabase.from("seo_keywords").upsert(
          {
            site_id: site.id,
            keyword: kw.keyword,
            page: kw.page,
            clicks: kw.clicks,
            impressions: kw.impressions,
            ctr: kw.ctr,
            position: kw.position,
            trend: kw.trend,
            search_intent: kw.search_intent,
            difficulty: kw.difficulty,
            priority_score: kw.priority_score,
          },
          { onConflict: "site_id,keyword,page" }
        );
      } catch (e) {
        // Ignorar erros de banco offline
      }
    }

    console.log(`[Keywords Explorer] ${Object.keys(kwMap).length} keywords reais processadas para ${site.name}.`);
  }

  return keywordsList;
}

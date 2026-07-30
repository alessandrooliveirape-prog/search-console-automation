import { supabase } from "../config/supabase";
import { siteProperties } from "../config/sites";
import { logEvent } from "../services/logger";

export type CannibalizationSeverity = "ALTA" | "MÉDIA" | "BAIXA";

export type CannibalizedUrlInfo = {
  url: string;
  clicks: number;
  impressions: number;
  avgPosition: number;
  ctr: number;
};

export type CannibalizationIssue = {
  id?: number;
  siteId: string;
  keyword: string;
  totalImpressions: number;
  totalClicks: number;
  severity: CannibalizationSeverity;
  competingUrls: CannibalizedUrlInfo[];
  primaryUrl: string;
  secondaryUrls: string[];
  suggestedAction: string;
  actionType: "FUSÃO_301" | "DIFERENCIAÇÃO_INTENÇÃO" | "AJUSTE_ANCHOR_TEXT";
  detectedAt: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runCannibalizationDetector(): Promise<CannibalizationIssue[]> {
  console.log("[Cannibalization Guard 6.0] Analisando conflitos de URLs disputando a mesma palavra-chave...");
  const issues: CannibalizationIssue[] = [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  const sinceStr = formatDate(sinceDate);

  for (const site of siteProperties) {
    try {
      // 1. Buscar buscas ordenadas por query e impressões no gsc_performance
      const { data: rows } = await supabase
        .from("gsc_performance")
        .select("query, page, clicks, impressions, ctr, position")
        .eq("site_id", site.id)
        .gte("date", sinceStr)
        .gte("impressions", 15);

      if (!rows || rows.length === 0) continue;

      // 2. Agrupar por query -> list de páginas
      const queryMap: Record<string, Record<string, { clicks: number; impressions: number; posSum: number; count: number }>> = {};

      for (const r of rows) {
        const q = (r.query || "").trim().toLowerCase();
        const p = r.page;
        if (!q || !p) continue;

        if (!queryMap[q]) queryMap[q] = {};
        if (!queryMap[q][p]) {
          queryMap[q][p] = { clicks: 0, impressions: 0, posSum: 0, count: 0 };
        }

        queryMap[q][p].clicks += r.clicks || 0;
        queryMap[q][p].impressions += r.impressions || 0;
        queryMap[q][p].posSum += r.position || 0;
        queryMap[q][p].count += 1;
      }

      // 3. Filtrar queries que possuem mais de 1 URL concorrendo
      for (const [query, pageDict] of Object.entries(queryMap)) {
        const pages = Object.keys(pageDict);
        if (pages.length < 2) continue;

        // Mapear cada URL com estatísticas consolidadas
        const urlInfos: CannibalizedUrlInfo[] = pages.map(url => {
          const stats = pageDict[url];
          const avgPos = stats.count > 0 ? stats.posSum / stats.count : 99;
          const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
          return {
            url,
            clicks: stats.clicks,
            impressions: stats.impressions,
            avgPosition: Number(avgPos.toFixed(1)),
            ctr: Number(ctr.toFixed(2))
          };
        }).sort((a, b) => b.clicks - a.clicks || a.avgPosition - b.avgPosition);

        const primaryUrl = urlInfos[0].url;
        const secondaryUrls = urlInfos.slice(1).map(u => u.url);
        const totalImpressions = urlInfos.reduce((a, b) => a + b.impressions, 0);
        const totalClicks = urlInfos.reduce((a, b) => a + b.clicks, 0);

        // Classificar severidade
        const top10Count = urlInfos.filter(u => u.avgPosition <= 10).length;
        let severity: CannibalizationSeverity = "BAIXA";
        if (top10Count >= 2 && totalImpressions >= 300) {
          severity = "ALTA";
        } else if (top10Count >= 1 || totalImpressions >= 150) {
          severity = "MÉDIA";
        }

        // Definir ação recomendada
        let actionType: "FUSÃO_301" | "DIFERENCIAÇÃO_INTENÇÃO" | "AJUSTE_ANCHOR_TEXT" = "DIFERENCIAÇÃO_INTENÇÃO";
        let suggestedAction = "";

        if (urlInfos[0].clicks > urlInfos[1].clicks * 4 && urlInfos[1].clicks < 5) {
          actionType = "FUSÃO_301";
          suggestedAction = `Redirecionar 301 de ${secondaryUrls[0].slice(0, 50)} para ${primaryUrl.slice(0, 50)} para consolidar autoridade.`;
        } else if (urlInfos[0].avgPosition <= 5 && urlInfos[1].avgPosition <= 12) {
          actionType = "AJUSTE_ANCHOR_TEXT";
          suggestedAction = `Remover a palavra-chave "${query}" das tags H2/H3 e alterar links internos da página secundária apontando para a principal.`;
        } else {
          actionType = "DIFERENCIAÇÃO_INTENÇÃO";
          suggestedAction = `Diferenciar os focos dos artigos: a página principal deve focar em "${query}" e a secundária em um termo de cauda longa mais específico.`;
        }

        const issueItem: CannibalizationIssue = {
          siteId: site.id,
          keyword: query,
          totalImpressions,
          totalClicks,
          severity,
          competingUrls: urlInfos,
          primaryUrl,
          secondaryUrls,
          suggestedAction,
          actionType,
          detectedAt: new Date().toISOString()
        };

        // Salvar no Supabase
        try {
          await supabase.from("bi_cannibalization").upsert({
            site_id: issueItem.siteId,
            keyword: issueItem.keyword,
            total_impressions: issueItem.totalImpressions,
            total_clicks: issueItem.totalClicks,
            severity: issueItem.severity,
            competing_urls: issueItem.competingUrls,
            primary_url: issueItem.primaryUrl,
            secondary_urls: issueItem.secondaryUrls,
            suggested_action: issueItem.suggestedAction,
            action_type: issueItem.actionType,
            detected_at: issueItem.detectedAt
          }, { onConflict: "site_id,keyword" });
        } catch (err: any) {
          console.warn("[Cannibalization] Aviso ao salvar no Supabase:", err.message);
        }

        issues.push(issueItem);
      }
    } catch (e: any) {
      console.error(`[Cannibalization] Erro no site ${site.id}:`, e.message);
    }
  }

  logEvent("system", "INFO", `[Cannibalization Guard 6.0] ${issues.length} conflitos de canibalização detectados`, {
    payload: { totalIssues: issues.length, highSeverity: issues.filter(i => i.severity === "ALTA").length }
  });

  return issues;
}

export async function fetchCannibalizationReport(siteId: string): Promise<CannibalizationIssue[]> {
  try {
    const { data } = await supabase
      .from("bi_cannibalization")
      .select("*")
      .eq("site_id", siteId)
      .order("total_impressions", { ascending: false });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      siteId: r.site_id,
      keyword: r.keyword,
      totalImpressions: r.total_impressions,
      totalClicks: r.total_clicks,
      severity: r.severity as CannibalizationSeverity,
      competingUrls: r.competing_urls || [],
      primaryUrl: r.primary_url,
      secondaryUrls: r.secondary_urls || [],
      suggestedAction: r.suggested_action,
      actionType: r.action_type,
      detectedAt: r.detected_at
    }));
  } catch (e: any) {
    console.warn("[Cannibalization] Erro ao buscar relatório do Supabase:", e.message);
    return [];
  }
}

import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";
import { generateTextWithGemini } from "./gemini";

export type AiDailyInsight = {
  site_id: string;
  date: string;
  daily_summary: string;
  critical_issues: string[];
  top_recommendations: string[];
  opportunities_summary: string[];
};

export async function runAiDailyInsightsJob(): Promise<AiDailyInsight[]> {
  console.log("[AI Insights Engine] Gerando insights reais via Gemini com dados do Supabase...");
  const insights: AiDailyInsight[] = [];
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const site of siteProperties) {
    // 1. Busca métricas reais do dia anterior
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { data: gscRows } = await supabase
      .from("gsc_performance")
      .select("clicks, impressions, ctr, position")
      .eq("site_id", site.id)
      .eq("date", yesterdayStr);

    let totalClicks = 0;
    let totalImpressions = 0;
    let avgCtr = 0;
    let avgPos = 0;

    if (gscRows && gscRows.length > 0) {
      totalClicks = gscRows.reduce((a, r) => a + (r.clicks || 0), 0);
      totalImpressions = gscRows.reduce((a, r) => a + (r.impressions || 0), 0);
      avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      avgPos = gscRows.reduce((a, r) => a + (r.position || 0), 0) / gscRows.length;
    }

    // 2. Busca SEO Score atual
    const { data: seoScore } = await supabase
      .from("seo_scores")
      .select("overall_score, status_label")
      .eq("site_id", site.id)
      .maybeSingle();

    // 3. Busca oportunidades críticas (alto impacto)
    const { data: criticalOps } = await supabase
      .from("seo_opportunities")
      .select("url, title, est_clicks_gain, impact_level, action_type")
      .eq("site_id", site.id)
      .eq("impact_level", "Alto Impacto")
      .order("est_clicks_gain", { ascending: false })
      .limit(3);

    // 4. Busca previsões
    const { data: predictions } = await supabase
      .from("seo_predictions")
      .select("url, predicted_ctr, predicted_clicks, explanation")
      .eq("site_id", site.id)
      .order("predicted_clicks", { ascending: false })
      .limit(3);

    // 5. Verifica se há dados para gerar insights
    if (totalClicks === 0 && totalImpressions === 0 && !seoScore) {
      console.warn(`[AI Insights] Sem dados reais para ${site.name}. Pulando.`);
      continue;
    }

    // 6. Monta prompt com dados reais para o Gemini
    const dataContext = `
Site: ${site.name} (${site.id})
Data: ${yesterdayStr}

MÉTRICAS GSC (ontem):
- Cliques totais: ${totalClicks}
- Impressões totais: ${totalImpressions}
- CTR médio: ${avgCtr.toFixed(2)}%
- Posição média: ${avgPos.toFixed(1)}

SEO SCORE:
- Score geral: ${seoScore?.overall_score ?? "não disponível"}/100
- Status: ${seoScore?.status_label ?? "não disponível"}

OPORTUNIDADES DE ALTO IMPACTO:
${criticalOps && criticalOps.length > 0
  ? criticalOps.map((op) => `- ${op.title} (URL: ${op.url}, ganho est.: +${op.est_clicks_gain} cliques)`).join("\n")
  : "- Nenhuma oportunidade crítica identificada"}

PREVISÕES DA IA:
${predictions && predictions.length > 0
  ? predictions.map((p) => `- ${p.url}: CTR previsto ${p.predicted_ctr}%, +${p.predicted_clicks} cliques`).join("\n")
  : "- Sem previsões disponíveis"}
`;

    const prompt = `Você é um especialista de SEO e analista de dados. Com base nos dados reais abaixo, gere:
1. Um RESUMO EXECUTIVO em português (2-3 parágrafos, tom profissional e direto)
2. Uma lista de PROBLEMAS CRÍTICOS identificados (máx. 3 itens concisos)
3. Uma lista de RECOMENDAÇÕES PRIORITÁRIAS (máx. 3 ações práticas e específicas)
4. Uma lista de OPORTUNIDADES DE CRESCIMENTO (máx. 3 insights)

Responda APENAS em JSON válido com a estrutura:
{
  "daily_summary": "string",
  "critical_issues": ["string", "string"],
  "top_recommendations": ["string", "string"],
  "opportunities_summary": ["string", "string"]
}

DADOS DO SITE:
${dataContext}`;

    let daily_summary = "";
    let critical_issues: string[] = [];
    let top_recommendations: string[] = [];
    let opportunities_summary: string[] = [];

    try {
      const rawResponse = await generateTextWithGemini(prompt);

      // Extrai JSON da resposta
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        daily_summary = parsed.daily_summary || "";
        critical_issues = parsed.critical_issues || [];
        top_recommendations = parsed.top_recommendations || [];
        opportunities_summary = parsed.opportunities_summary || [];
      } else {
        daily_summary = rawResponse;
      }
    } catch (err: any) {
      console.error(`[AI Insights] Erro ao gerar insights com Gemini para ${site.name}:`, err.message);
      daily_summary = `Dados coletados em ${dateStr}: ${totalClicks} cliques, ${totalImpressions} impressões, CTR ${avgCtr.toFixed(2)}%, posição média ${avgPos.toFixed(1)}.`;
      critical_issues = avgCtr < 2 ? [`CTR de ${avgCtr.toFixed(2)}% está abaixo da meta de 3.5%.`] : [];
      top_recommendations = ["Executar análise completa de oportunidades de CTR."];
      opportunities_summary = [`${totalImpressions.toLocaleString()} impressões disponíveis para conversão.`];
    }

    const insight: AiDailyInsight = {
      site_id: site.id,
      date: dateStr,
      daily_summary,
      critical_issues,
      top_recommendations,
      opportunities_summary,
    };

    insights.push(insight);

    try {
      await supabase.from("ai_daily_insights").upsert(
        {
          site_id: site.id,
          date: dateStr,
          daily_summary,
          critical_issues,
          top_recommendations,
          opportunities_summary,
        },
        { onConflict: "site_id,date" }
      );
    } catch (e) {
      // Ignorar erro de banco
    }

    console.log(`[AI Insights] Insight gerado pelo Gemini para ${site.name} com dados reais.`);
  }

  return insights;
}

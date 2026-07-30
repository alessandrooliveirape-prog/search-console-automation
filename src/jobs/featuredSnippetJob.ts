import { supabase } from "../config/supabase";
import { sendWhatsAppAlert } from "../services/notifications";
import { optimizeMetadata } from "../services/gemini";
import { siteProperties } from "../config/sites";

export async function runFeaturedSnippetJob() {
  console.log("[Featured Snippet] Caçando oportunidades de posição 0...");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  const start = startDate.toISOString().slice(0, 10);
  const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  for (const site of siteProperties) {
    try {
      // Busca queries nas posições 2-8 com alta exposição
      const { data } = await supabase
        .from("gsc_performance")
        .select("query, page, clicks, impressions, position")
        .eq("site_id", site.id)
        .gte("date", start)
        .lte("date", end)
        .gte("impressions", 100) // mínimo de exposição
        .not("query", "is", null);

      if (!data || data.length === 0) continue;

      // Agrega por query+página
      const aggMap = new Map<string, { query: string; page: string; clicks: number; impressions: number; posSum: number; count: number }>();
      for (const row of data) {
        const key = `${row.query}|||${row.page}`;
        if (!aggMap.has(key)) aggMap.set(key, { query: row.query, page: row.page, clicks: 0, impressions: 0, posSum: 0, count: 0 });
        const e = aggMap.get(key)!;
        e.clicks += row.clicks || 0;
        e.impressions += row.impressions || 0;
        e.posSum += (row.position || 0) * (row.impressions || 1);
        e.count += row.impressions || 1;
      }

      // Filtra posições 2-8 com alta impressão = candidatos ao snippet
      const opportunities = [...aggMap.values()]
        .map(e => ({ ...e, avgPos: e.posSum / e.count }))
        .filter(e => e.avgPos >= 2 && e.avgPos <= 8 && e.impressions >= 200)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);

      if (opportunities.length === 0) {
        console.log(`[Featured Snippet] ${site.name}: sem oportunidades no momento.`);
        continue;
      }

      console.log(`[Featured Snippet] ${site.name}: ${opportunities.length} oportunidade(s) de posição 0 encontradas.`);

      const list = opportunities.map(op => {
        const path = op.page.replace(/^https?:\/\/[^/]+/, "");
        return `  • *"${op.query}"* (pos ${op.avgPos.toFixed(1)}, ${op.impressions} impressões)\n    Página: \`${path}\``;
      }).join("\n");

      const msg = `🎯 *Featured Snippet Opportunities em ${site.name}!*\n\n` +
        `${opportunities.length} query(s) na posição 2-8 com alto volume — candidatas ao \`Posição 0\`:\n\n${list}\n\n` +
        `💡 *Como capturar:* Reformate a resposta em lista numerada, tabela ou definição direta no início da página. O Google tende a selecionar respostas estruturadas para o snippet.`;

      await sendWhatsAppAlert(msg);

      // Salva oportunidades no Supabase
      for (const op of opportunities) {
        try {
          await supabase.from("seo_alerts").upsert({
            site_id: site.id,
            type: "featured_snippet_opportunity",
            url: op.page,
            details: { query: op.query, avg_position: op.avgPos, impressions: op.impressions, clicks: op.clicks },
            created_at: new Date().toISOString(),
          }, { onConflict: "site_id,type,url" });
        } catch {}
      }

    } catch (err: any) {
      console.error(`[Featured Snippet] Erro em ${site.name}:`, err.message);
    }
  }

  console.log("[Featured Snippet] Análise concluída.");
}

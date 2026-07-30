import { supabase } from "../config/supabase";
import { sendWhatsAppAlert } from "../services/notifications";
import { siteProperties } from "../config/sites";

interface DecayPage {
  site_id: string;
  page: string;
  week1_clicks: number;
  week2_clicks: number;
  week3_clicks: number;
  decay_pct: number;
}

function weekRange(weeksAgo: number): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - (weeksAgo * 7));
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function getWeeklyClicks(siteId: string, start: string, end: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("gsc_performance")
    .select("page, clicks")
    .eq("site_id", siteId)
    .gte("date", start)
    .lte("date", end);

  const map = new Map<string, number>();
  for (const row of data || []) {
    map.set(row.page, (map.get(row.page) || 0) + row.clicks);
  }
  return map;
}

export async function runContentDecayJob() {
  console.log("[Content Decay] Analisando páginas com queda consistente de tráfego...");

  const w1 = weekRange(1);
  const w2 = weekRange(2);
  const w3 = weekRange(3);

  for (const site of siteProperties) {
    try {
      const [clicks1, clicks2, clicks3] = await Promise.all([
        getWeeklyClicks(site.id, w1.start, w1.end),
        getWeeklyClicks(site.id, w2.start, w2.end),
        getWeeklyClicks(site.id, w3.start, w3.end),
      ]);

      const decayPages: DecayPage[] = [];

      for (const [page, c3] of clicks3.entries()) {
        const c2 = clicks2.get(page) || 0;
        const c1 = clicks1.get(page) || 0;

        // Queda consistente por 3 semanas + tráfego mínimo para ser relevante
        const isDecaying = c3 > c2 && c2 > c1 && c3 > 10;
        if (!isDecaying) continue;

        const decayPct = c3 > 0 ? Math.round(((c3 - c1) / c3) * 100) : 0;
        if (decayPct < 20) continue; // só alerta se queda > 20%

        decayPages.push({ site_id: site.id, page, week1_clicks: c1, week2_clicks: c2, week3_clicks: c3, decay_pct: decayPct });
      }

      if (decayPages.length === 0) {
        console.log(`[Content Decay] ${site.name}: nenhum decaimento significativo detectado.`);
        continue;
      }

      // Ordena pelas páginas com maior queda absoluta
      decayPages.sort((a, b) => (b.week3_clicks - b.week1_clicks) - (a.week3_clicks - a.week1_clicks));
      const top = decayPages.slice(0, 5);

      console.log(`[Content Decay] ${site.name}: ${decayPages.length} página(s) em decaimento. Top: ${top[0].page}`);

      // Salva no Supabase
      for (const p of top) {
        try {
          await supabase.from("seo_alerts").upsert({
            site_id: p.site_id,
            type: "content_decay",
            url: p.page,
            details: { week3_clicks: p.week3_clicks, week2_clicks: p.week2_clicks, week1_clicks: p.week1_clicks, decay_pct: p.decay_pct },
            created_at: new Date().toISOString(),
          }, { onConflict: "site_id,type,url" });
        } catch {}
      }

      // Monta alerta
      const list = top.map(p => {
        const path = p.page.replace(/^https?:\/\/[^/]+/, "");
        return `  • \`${path}\` — ${p.week3_clicks} → ${p.week2_clicks} → ${p.week1_clicks} cliques (-${p.decay_pct}%)`;
      }).join("\n");

      const msg = `📉 *Content Decay detectado em ${site.name}!*\n\n` +
        `${decayPages.length} página(s) com queda por 3 semanas consecutivas:\n\n${list}\n\n` +
        `💡 Ação: Atualize o conteúdo, reforce os links internos ou melhore o título dessas páginas.`;

      await sendWhatsAppAlert(msg);

    } catch (err: any) {
      console.error(`[Content Decay] Erro em ${site.name}:`, err.message);
    }
  }

  console.log("[Content Decay] Análise concluída.");
}

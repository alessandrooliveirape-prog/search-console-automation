import { supabase } from "../config/supabase";
import { siteProperties } from "../config/sites";
import { optimizeMetadata } from "../services/gemini";
import { sendWhatsAppAlert } from "../services/notifications";

export type TrafficDropAlert = {
  siteId: string;
  siteName: string;
  url: string;
  query: string;
  prevImpressions: number;
  currImpressions: number;
  dropPercent: number;
  prevClicks: number;
  currClicks: number;
  aiDiagnosis: string;
  suggestedAction: string;
  detectedAt: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runTrafficDropDetector(): Promise<TrafficDropAlert[]> {
  console.log("[Traffic Drop Detector] Analisando variações semanais de impressões e tráfego (WoW)...");
  const alerts: TrafficDropAlert[] = [];

  const now = new Date();
  
  // Semana Atual: últimos 7 dias (d-7 até d-1)
  const currEnd = new Date(now); currEnd.setDate(currEnd.getDate() - 1);
  const currStart = new Date(now); currStart.setDate(currStart.getDate() - 7);

  // Semana Anterior: 7 dias antes da semana atual (d-14 até d-8)
  const prevEnd = new Date(now); prevEnd.setDate(prevEnd.getDate() - 8);
  const prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - 14);

  for (const site of siteProperties) {
    try {
      // 1. Dados da Semana Anterior
      const { data: prevRows } = await supabase
        .from("gsc_performance")
        .select("page, query, clicks, impressions")
        .eq("site_id", site.id)
        .gte("date", formatDate(prevStart))
        .lte("date", formatDate(prevEnd));

      // 2. Dados da Semana Atual
      const { data: currRows } = await supabase
        .from("gsc_performance")
        .select("page, query, clicks, impressions")
        .eq("site_id", site.id)
        .gte("date", formatDate(currStart))
        .lte("date", formatDate(currEnd));

      if (!prevRows || prevRows.length === 0 || !currRows || currRows.length === 0) {
        continue;
      }

      // Agrupa por página na Semana Anterior
      const prevMap: Record<string, { clicks: number; impressions: number; bestQuery: string }> = {};
      for (const r of prevRows) {
        const page = r.page || "";
        if (!prevMap[page]) prevMap[page] = { clicks: 0, impressions: 0, bestQuery: r.query || "" };
        prevMap[page].clicks += r.clicks || 0;
        prevMap[page].impressions += r.impressions || 0;
      }

      // Agrupa por página na Semana Atual
      const currMap: Record<string, { clicks: number; impressions: number; bestQuery: string }> = {};
      for (const r of currRows) {
        const page = r.page || "";
        if (!currMap[page]) currMap[page] = { clicks: 0, impressions: 0, bestQuery: r.query || "" };
        currMap[page].clicks += r.clicks || 0;
        currMap[page].impressions += r.impressions || 0;
      }

      // Compara WoW para cada página com tráfego relevante (mínimo 50 impressões na semana anterior)
      for (const [page, prevStats] of Object.entries(prevMap)) {
        if (prevStats.impressions < 50) continue;

        const currStats = currMap[page] || { clicks: 0, impressions: 0, bestQuery: prevStats.bestQuery };
        const imprDropPct = ((prevStats.impressions - currStats.impressions) / prevStats.impressions) * 100;

        // Se a queda de impressões for superior a 20%
        if (imprDropPct >= 20) {
          const query = currStats.bestQuery || prevStats.bestQuery || "termo principal";
          
          // Diagnóstico inteligente da IA Gemini
          let aiDiagnosis = "Queda acentuada no volume de buscas ou perda de visibilidade na SERP.";
          let suggestedAction = "Revisar metadados, atualizar conteúdo e re-indexar no Google e IndexNow.";

          try {
            const aiResult = await optimizeMetadata({
              url: page,
              query: query,
              clicks: currStats.clicks,
              impressions: currStats.impressions,
              position: 15
            });
            aiDiagnosis = `A IA Gemini sugere atualizar para a copy: "${aiResult.title}". Meta: ${aiResult.metaDescription}`;
          } catch (e) {
            // Utiliza diagnóstico padrão em caso de erro na API
          }

          const alertItem: TrafficDropAlert = {
            siteId: site.id,
            siteName: site.name,
            url: page,
            query: query,
            prevImpressions: prevStats.impressions,
            currImpressions: currStats.impressions,
            dropPercent: Number(imprDropPct.toFixed(1)),
            prevClicks: prevStats.clicks,
            currClicks: currStats.clicks,
            aiDiagnosis,
            suggestedAction,
            detectedAt: new Date().toISOString()
          };

          alerts.push(alertItem);

          // Dispara alerta preditivo urgente via WhatsApp + Telegram
          const urlPath = page.replace(/^https?:\/\/[^\/]+/, "");
          const alertMsg =
            `🚨 *ALERTA PREDITIVO DE QUEDA DE TRÁFEGO (WoW)*\n\n` +
            `🌐 *Site:* ${site.name}\n` +
            `📄 *Página:* \`${urlPath}\`\n` +
            `🔑 *Palavra-chave:* "${query}"\n` +
            `📉 *Queda de Impressões:* -${alertItem.dropPercent}% (${prevStats.impressions} ➔ ${currStats.impressions})\n` +
            `🖱️ *Cliques:* ${prevStats.clicks} ➔ ${currStats.clicks}\n\n` +
            `🧠 *Diagnóstico IA:* ${aiDiagnosis}\n\n` +
            `💡 *Ação Recomendada:* ${suggestedAction}`;

          await sendWhatsAppAlert(alertMsg);
        }
      }
    } catch (e: any) {
      console.error(`[Traffic Drop Detector] Erro ao analisar site ${site.name}:`, e.message);
    }
  }

  console.log(`[Traffic Drop Detector] ${alerts.length} alertas preditivos de queda de tráfego gerados.`);
  return alerts;
}

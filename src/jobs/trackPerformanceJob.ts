import { supabase } from "../config/supabase";
import { getSearchAnalytics } from "../services/searchAnalytics";
import { sendWhatsAppAlert } from "../services/notifications";

function dateOffset(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runTrackPerformanceJob() {
  console.log("[Job] Rodando acompanhamento de performance de SEO (Antes vs Depois)...");

  try {
    // 1. Auto-inicializa o campo approved_at para overrides aprovados recentemente
    const { data: newlyApproved, error: initError } = await supabase
      .from("seo_overrides")
      .select("id")
      .eq("approved", true)
      .is("approved_at", null);

    if (!initError && newlyApproved && newlyApproved.length > 0) {
      const ids = newlyApproved.map(x => x.id);
      await supabase
        .from("seo_overrides")
        .update({ approved_at: new Date().toISOString() })
        .in("id", ids);
      console.log(`[Job] Campo approved_at inicializado para ${newlyApproved.length} overrides.`);
    }

    // 2. Busca overrides aprovados que ainda não completaram o rastreamento de 14 dias
    const { data: activeTrackings, error } = await supabase
      .from("seo_overrides")
      .select("*")
      .eq("approved", true)
      .not("approved_at", "is", null)
      .lt("tracked_days", 14);

    if (error) {
      console.error("[Job] Erro ao buscar overrides ativos para rastreamento:", error.message);
      return;
    }

    if (!activeTrackings || activeTrackings.length === 0) {
      console.log("[Job] Nenhuma página ativa em período de auditoria no momento.");
      return;
    }

    console.log(`[Job] Acompanhando performance de ${activeTrackings.length} otimização(ões)...`);

    for (const ov of activeTrackings) {
      const approvedDate = new Date(ov.approved_at);
      const today = new Date();
      
      // Espera 16 dias após a aprovação para ter os 14 dias completos de dados no GSC (que tem delay de 2 dias)
      const diffTime = Math.abs(today.getTime() - approvedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 16) {
        console.log(`[Job] URL ${ov.url} aprovada há ${diffDays} dias. Aguardando 16 dias para auditoria completa.`);
        continue;
      }

      console.log(`[Job] Iniciando comparação de métricas para a URL: ${ov.url}`);

      // Períodos de 14 dias
      const beforeStart = dateOffset(approvedDate, -15);
      const beforeEnd = dateOffset(approvedDate, -1);
      const afterStart = dateOffset(approvedDate, 1);
      const afterEnd = dateOffset(approvedDate, 15);

      try {
        // Consulta GSC para o período ANTES
        const rowsBefore = await getSearchAnalytics({
          siteUrl: ov.site_id,
          startDate: beforeStart,
          endDate: beforeEnd,
          dimensions: ["page"],
          rowLimit: 1000,
        });

        // Consulta GSC para o período DEPOIS
        const rowsAfter = await getSearchAnalytics({
          siteUrl: ov.site_id,
          startDate: afterStart,
          endDate: afterEnd,
          dimensions: ["page"],
          rowLimit: 1000,
        });

        const beforeMetrics = rowsBefore.find((r) => (r.keys?.[0] || "") === ov.url) || { clicks: 0, impressions: 0, ctr: 0 };
        const afterMetrics = rowsAfter.find((r) => (r.keys?.[0] || "") === ov.url) || { clicks: 0, impressions: 0, ctr: 0 };

        const clicksBefore = beforeMetrics.clicks ?? 0;
        const clicksAfter = afterMetrics.clicks ?? 0;
        const ctrBefore = beforeMetrics.ctr ?? 0.0;
        const ctrAfter = afterMetrics.ctr ?? 0.0;

        // Atualiza métricas no Supabase
        await supabase
          .from("seo_overrides")
          .update({
            clicks_before: clicksBefore,
            clicks_after: clicksAfter,
            ctr_before: ctrBefore,
            ctr_after: ctrAfter,
            tracked_days: 14,
            updated_at: new Date().toISOString()
          })
          .eq("id", ov.id);

        console.log(`[Job] Métricas salvas para ${ov.url}. Cliques: ${clicksBefore} -> ${clicksAfter}`);

        // Envia notificação com os resultados no WhatsApp
        const clickDiff = clicksAfter - clicksBefore;
        const clickPct = clicksBefore > 0 ? ((clickDiff / clicksBefore) * 100).toFixed(1) : "100+";
        const ctrDiff = ((ctrAfter - ctrBefore) * 100).toFixed(2);

        let whatsappMsg = "";
        if (clickDiff > 0) {
          whatsappMsg = `🔥 *Resultado de SEO IA!* A otimização da página ${ov.url.replace(/^https?:\/\/[^\/]+/, "")} deu frutos:\n\n` +
                        `📈 *Cliques nos últimos 14 dias:* ${clicksBefore} ➔ ${clicksAfter} (+${clickPct}%)\n` +
                        `🎯 *CTR médio:* ${(ctrBefore * 100).toFixed(2)}% ➔ ${(ctrAfter * 100).toFixed(2)}% (${Number(ctrDiff) >= 0 ? "+" : ""}${ctrDiff}%)\n` +
                        `Palavra-chave: "${ov.target_query}"`;
        } else {
          whatsappMsg = `📊 *Auditoria de SEO:* Rastreamento concluído para ${ov.url.replace(/^https?:\/\/[^\/]+/, "")}:\n\n` +
                        `• Cliques: ${clicksBefore} ➔ ${clicksAfter}\n` +
                        `• CTR: ${(ctrBefore * 100).toFixed(2)}% ➔ ${(ctrAfter * 100).toFixed(2)}%\n` +
                        `Palavra-chave: "${ov.target_query}"`;
        }

        await sendWhatsAppAlert(whatsappMsg);

      } catch (err: any) {
        console.error(`[Job] Erro ao buscar métricas para override ${ov.url}:`, err.message || err);
      }
    }
  } catch (err: any) {
    console.error("[Job] Falha no trackPerformanceJob:", err.message || err);
  }
}

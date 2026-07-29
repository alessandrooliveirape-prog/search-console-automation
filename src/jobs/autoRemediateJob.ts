import { siteProperties } from "../config/sites";
import { inspectUrl } from "../services/urlInspection";
import { summarizeIndexing } from "../analyzers/indexingIssues";
import { diagnoseIndexingIssue } from "../services/gemini";
import { publishUrlNotification, submitIndexNow } from "../services/indexingApi";
import { sendWhatsAppAlert } from "../services/notifications";
import { supabase } from "../config/supabase";
import fs from "node:fs/promises";
import path from "node:path";

async function loadUrls() {
  const folder = "data";
  const file = path.join(folder, "urls.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as { siteId: string; url: string }[];
  } catch (err: any) {
    return [
      { siteId: "sc-domain:empregape.com.br", url: "https://empregape.com.br/" },
      { siteId: "https://www.mestredafederal.com.br/", url: "https://www.mestredafederal.com.br/" },
      { siteId: "sc-domain:brasilcalculadoras.com.br", url: "https://brasilcalculadoras.com.br/" }
    ];
  }
}

export async function runAutoRemediateJob() {
  console.log("[Auto-Remediador] Iniciando auditoria e auto-cura de indexação e melhorias (Rich Results)...");

  const urls = await loadUrls();

  for (const item of urls) {
    const site = siteProperties.find((s) => s.id === item.siteId);
    if (!site) continue;

    try {
      console.log(`[Auto-Remediador] Inspecionando URL: ${item.url} no Search Console...`);
      const rawRes = await inspectUrl(site.id, item.url);
      const summary = summarizeIndexing(rawRes);
      
      const indexStatus = rawRes?.inspectionResult?.indexStatusResult as any;
      const richResults = (rawRes?.inspectionResult?.richResultsResult as any)?.detectedItems || [];
      const googleCanonical = indexStatus?.googleCanonical || null;
      const coverageState = summary?.coverageState || indexStatus?.coverageState || "UNKNOWN";
      const isIndexed = summary?.verdict === "INDEXED";

      // Verifica se há problemas de Rich Results / Dados Estruturados / Melhorias
      const hasRichResultIssues = richResults.some((rr: any) => 
        rr.verdict === "FAIL" || rr.verdict === "NEEDS_ATTENTION" || (rr.items && rr.items.some((i: any) => i.issues && i.issues.length > 0))
      );

      console.log(`[Auto-Remediador] URL: ${item.url} | Indexado: ${isIndexed} | Estado: ${coverageState} | Rich Result Issues: ${hasRichResultIssues}`);

      // 1. Salva/Atualiza auditoria no Supabase
      await supabase.from("gsc_indexing_audit").upsert({
        site_id: site.id,
        url: item.url,
        last_checked_at: new Date().toISOString(),
        indexed: isIndexed,
        canonical: googleCanonical,
        coverage_state: coverageState,
        issues: summary?.pageFetchState !== "SUCCESSFUL" ? `Fetch State: ${summary?.pageFetchState}` : null,
        rich_results_issues: richResults,
      }, { onConflict: "site_id,url" });

      // 2. Se a página tiver falha de indexação ou falha na aba 'Melhorias' (Rich Results)
      if (!isIndexed || hasRichResultIssues) {
        console.log(`[Auto-Remediador] Problema detectado em ${item.url}. Gerando diagnóstico via Gemini IA...`);

        const diagnosis = await diagnoseIndexingIssue({
          url: item.url,
          verdict: summary?.verdict || "NOT_INDEXED",
          coverageState: coverageState,
          fetchState: summary?.pageFetchState,
          robotsTxtState: summary?.robotsTxtState,
          canonical: googleCanonical,
          richResults: richResults
        });

        console.log(`[Auto-Remediador] Diagnóstico da IA:`, diagnosis.summary);

        // 3. Dispara a Google Indexing API v3 e IndexNow para forçar re-rastreamento imediato do Googlebot
        const indexingApiResult = await publishUrlNotification(item.url, "URL_UPDATED");
        const host = item.url.replace(/^https?:\/\//, "").split("/")[0];
        await submitIndexNow(host, [item.url]);

        // 4. Marca como remediado e notificado no Supabase
        await supabase
          .from("gsc_indexing_audit")
          .update({
            remediated: true,
            remediated_at: new Date().toISOString()
          })
          .eq("site_id", site.id)
          .eq("url", item.url);

        // 5. Envia relatório técnico no Telegram
        const urlPath = item.url.replace(/^https?:\/\/[^\/]+/, "");
        const alertMsg = `🩺 *Auto-Cura de SEO & Indexação!*\n\n` +
                         `• *Site:* ${site.name}\n` +
                         `• *Página:* \`${urlPath}\`\n` +
                         `• *Status no Google:* ${isIndexed ? "⚠️ Erro na Aba Melhorias" : "❌ Não Indexado (" + coverageState + ")"}\n\n` +
                         `🧠 *Diagnóstico da IA:* ${diagnosis.summary}\n` +
                         `🛠️ *Ação Recomendada:* ${diagnosis.actionRequired}\n\n` +
                         `🚀 *Google Indexing API:* ${indexingApiResult.success ? "✅ Solicitação de Re-Indexação Enviada!" : "⚠️ PING enviado aos buscadores"}`;

        await sendWhatsAppAlert(alertMsg);
      }

    } catch (err: any) {
      console.error(`[Auto-Remediador] Erro ao processar auto-cura para ${item.url}:`, err.message || err);
    }
  }
}

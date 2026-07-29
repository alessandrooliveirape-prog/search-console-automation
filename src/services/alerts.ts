import { logEvent } from "./logger";
import { sendTelegramApprovalRequest } from "./notifications";

export type AlertType =
  | "CTR_DROP"
  | "SEO_SCORE_DROP"
  | "HEALTH_DROP"
  | "INDEXING_FAILURE"
  | "API_DOWN"
  | "CRON_FAILURE"
  | "QUOTA_EXHAUSTED"
  | "GEMINI_FAILURE"
  | "SUPABASE_FAILURE";

export async function sendProactiveAlert(type: AlertType, title: string, details: string, siteId?: string) {
  const alertMsg = `⚠️ *ALERTA ENTERPRISE DE SEGURANÇA & SEO* ⚠️\n\n` +
    `• *Tipo:* ${type}\n` +
    `• *Assunto:* ${title}\n` +
    (siteId ? `• *Site:* ${siteId}\n` : "") +
    `• *Detalhes:* ${details}\n\n` +
    `📅 *Timestamp:* ${new Date().toLocaleString("pt-BR")}`;

  logEvent("errors", "WARN", `ProactiveAlert [${type}]: ${title}`, { payload: { siteId, details } });

  // Log in local json file
  try {
    const { saveJson } = await import("../outputs/files");
    await saveJson("reports/alerts", `alert-${type.toLowerCase()}-${Date.now()}`, { type, title, details, siteId });
  } catch (e) {
    // Ignore
  }

  return true;
}

import { supabase } from "../config/supabase";
import { sendWhatsAppAlert } from "./notifications";

export type WhatsAppCommandResult = {
  handled: boolean;
  replyMessage: string;
};

export async function processWhatsAppCommand(messageText: string): Promise<WhatsAppCommandResult> {
  const text = messageText.trim().toLowerCase();

  // 1. Comando: "aprovar <id>" ou "aprovar"
  if (text.startsWith("aprovar")) {
    const match = text.match(/aprovar\s+(\d+)/i);
    const id = match ? parseInt(match[1], 10) : null;

    if (id) {
      const { data, error } = await supabase
        .from("seo_overrides")
        .update({ approved: true, approved_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();

      if (!error && data) {
        const reply = `✅ *Otimização #${id} Aprovada no WhatsApp!*\n\n• Página: \`${data.url}\`\n• Título Otimizado: *${data.optimized_title}*\n\n✨ A alteração foi enviada para o rebuild estático e atualização via REST API.`;
        await sendWhatsAppAlert(reply);
        return { handled: true, replyMessage: reply };
      } else {
        const reply = `⚠️ Não foi possível localizar ou aprovar a otimização #${id}. Verifique se o ID está correto.`;
        await sendWhatsAppAlert(reply);
        return { handled: true, replyMessage: reply };
      }
    } else {
      // Busca a última otimização pendente
      const { data: pending } = await supabase
        .from("seo_overrides")
        .select("*")
        .eq("approved", false)
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (pending) {
        await supabase
          .from("seo_overrides")
          .update({ approved: true, approved_at: new Date().toISOString() })
          .eq("id", pending.id);

        const reply = `✅ *Última Otimização Pendente (#${pending.id}) Aprovada via WhatsApp!*\n\n• URL: \`${pending.url}\`\n• Novo Título: *${pending.optimized_title}*`;
        await sendWhatsAppAlert(reply);
        return { handled: true, replyMessage: reply };
      } else {
        const reply = `ℹ️ Nenhuma otimização pendente encontrada no momento.`;
        await sendWhatsAppAlert(reply);
        return { handled: true, replyMessage: reply };
      }
    }
  }

  // 2. Comando: "status" ou "resumo"
  if (text.includes("status") || text.includes("resumo")) {
    const { count: perfCount } = await supabase.from("gsc_performance").select("*", { count: "exact", head: true });
    const { count: pendingCount } = await supabase.from("seo_overrides").select("*", { count: "exact", head: true }).eq("approved", false);
    const { count: approvedCount } = await supabase.from("seo_overrides").select("*", { count: "exact", head: true }).eq("approved", true);

    const reply =
      `📊 *Status do Sistema SEO & Search Console BI*\n\n` +
      `• *Linhas no Data Warehouse:* ${perfCount || 0}\n` +
      `• *Otimizações Aprovadas:* ${approvedCount || 0} ✅\n` +
      `• *Otimizações Pendentes:* ${pendingCount || 0} ⏳\n` +
      `• *Serviços:* Search Console, Indexing API, Gemini AI & Supabase ONLINE 🚀`;

    await sendWhatsAppAlert(reply);
    return { handled: true, replyMessage: reply };
  }

  // 3. Comando: "relatorio" ou "ajuda"
  if (text.includes("relatorio") || text.includes("ajuda") || text.includes("comandos")) {
    const reply =
      `💡 *Comandos Disponíveis no WhatsApp:*\n\n` +
      `1️⃣ *Aprovar <ID>* — Aprova e publica a otimização de SEO pelo ID (ex: \`Aprovar 102\`)\n` +
      `2️⃣ *Status* — Exibe o resumo do sistema e contagem de métricas\n` +
      `3️⃣ *Relatorio* — Mostra esta mensagem de comandos disponíveis`;

    await sendWhatsAppAlert(reply);
    return { handled: true, replyMessage: reply };
  }

  return { handled: false, replyMessage: "Comando não reconhecido. Digite 'ajuda' para ver a lista de comandos." };
}

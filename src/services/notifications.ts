import { env } from "../config/env";

export async function sendWhatsAppAlert(message: string): Promise<boolean> {
  const phone = "558198372170";
  const apiKey = env.CALLMEBOT_API_KEY;

  // Tenta enviar também via Telegram se configurado no processo
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) {
    try {
      const tgUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
      await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: "Markdown" })
      });
      console.log("[Telegram Notifier] Alerta enviado via Telegram.");
    } catch (e: any) {
      console.error("[Telegram Notifier] Falha ao enviar:", e.message);
    }
  }

  if (!apiKey || apiKey.trim() === "") {
    console.log(`[WhatsApp Notifier] (Simulado - configure CALLMEBOT_API_KEY no .env para enviar ao WhatsApp): ${message}`);
    return false;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`[WhatsApp Notifier] Alerta enviado com sucesso para ${phone}`);
      return true;
    } else {
      const errText = await res.text();
      console.error(`[WhatsApp Notifier] Falha ao enviar para ${phone}. Status: ${res.status}. Detalhes: ${errText}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[WhatsApp Notifier] Erro ao disparar alerta de WhatsApp:`, error.message || error);
    return false;
  }
}

export async function sendTelegramApprovalRequest(data: {
  id: number;
  url: string;
  query: string;
  originalTitle: string | null;
  optimizedTitle: string;
}): Promise<boolean> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken || !telegramChatId) {
    console.log(`[Telegram Approver] Bot não configurado. Pulando solicitação de aprovação no Telegram.`);
    return false;
  }

  const urlPath = data.url.replace(/^https?:\/\/[^\/]+/, "");
  
  const text = `🤖 *Nova Otimização de SEO Disponível!*\n\n` +
               `• *Página:* \`${urlPath}\`\n` +
               `• *Palavra-chave:* "${data.query}"\n\n` +
               `❌ *Antes:* _${data.originalTitle || "Não detectado"}_\n` +
               `🏆 *Depois (IA):* *${data.optimizedTitle}*\n\n` +
               `Deseja aprovar e publicar esta alteração no site?`;

  const tgUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
  const body = {
    chat_id: telegramChatId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✓ Aprovar e Publicar",
            callback_data: `approve_${data.id}`
          },
          {
            text: "Ignorar",
            callback_data: `ignore_${data.id}`
          }
        ]
      ]
    }
  };

  try {
    const res = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      console.log(`[Telegram Approver] Solicitação de aprovação enviada para o ID: ${data.id}`);
      return true;
    } else {
      const errText = await res.text();
      console.error(`[Telegram Approver] Falha ao enviar para o Telegram:`, errText);
      return false;
    }
  } catch (error: any) {
    console.error(`[Telegram Approver] Erro ao disparar mensagem para o Telegram:`, error.message || error);
    return false;
  }
}

export async function sendAutoExecutionAlert(data: {
  siteName: string;
  url: string;
  query: string;
  position: number;
  clicks: number;
  impressions: number;
  originalTitle: string | null;
  optimizedTitle: string;
  optimizedMeta: string;
}): Promise<boolean> {
  const urlPath = data.url.replace(/^https?:\/\/[^\/]+/, "");
  const formattedPos = data.position.toFixed(1);

  const message =
    `🤖⚡ *Otimização de SEO Auto-Executada (Posição > 30)*\n\n` +
    `🌐 *Site:* ${data.siteName}\n` +
    `📄 *Página:* \`${urlPath}\`\n` +
    `🔑 *Palavra-chave:* "${data.query}"\n` +
    `📊 *Posição GSC:* ${formattedPos} (Posição > 30 — Auto-Aprovada pelo Sistema)\n` +
    `👁️ *Impressões:* ${data.impressions.toLocaleString("pt-BR")} | Cliques: ${data.clicks}\n\n` +
    `❌ *Antes:* _${data.originalTitle || "Padrão do site"}_\n` +
    `🏆 *Depois (IA Gemini):* *${data.optimizedTitle}*\n` +
    `📝 *Meta Description:* ${data.optimizedMeta}\n\n` +
    `✅ *Status:* Otimização APROVADA e agendada para publicação automática!`;

  // 1. Notificar via Telegram
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) {
    try {
      const tgUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
      await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: "Markdown" })
      });
      console.log(`[Auto-Exec Notifier] Notificação enviada ao Telegram para: ${urlPath}`);
    } catch (e: any) {
      console.error("[Auto-Exec Notifier] Falha ao enviar para o Telegram:", e.message);
    }
  }

  // 2. Notificar via WhatsApp (CallMeBot)
  try {
    const waSent = await sendWhatsAppAlert(message);
    if (waSent) {
      console.log(`[Auto-Exec Notifier] Notificação enviada ao WhatsApp para: ${urlPath}`);
    }
  } catch (e: any) {
    console.error("[Auto-Exec Notifier] Falha ao enviar para o WhatsApp:", e.message);
  }

  return true;
}




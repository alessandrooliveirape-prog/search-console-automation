import { supabase } from "../config/supabase";
import { runRebuildWebsitesJob } from "../jobs/rebuildWebsitesJob";

let lastUpdateId = 0;
let isPolling = false;

export async function startTelegramBotListener() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.trim() === "") {
    console.log("[Telegram Listener] Token não configurado. Listener inativo.");
    return;
  }

  console.log("[Telegram Listener] Iniciando escuta de comandos em segundo plano...");
  isPolling = true;
  pollUpdates(token);
}

export function stopTelegramBotListener() {
  isPolling = false;
  console.log("[Telegram Listener] Escuta de comandos parada.");
}

async function pollUpdates(token: string) {
  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Telegram API Error: Status ${res.status}`);
      }

      const data: any = await res.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          await handleTelegramUpdate(token, update);
        }
      }
    } catch (err: any) {
      console.error("[Telegram Listener] Erro ao buscar atualizações do Telegram:", err.message || err);
      // Espera 5 segundos antes de tentar de novo em caso de erro para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Pequeno intervalo entre requisições
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function handleTelegramUpdate(token: string, update: any) {
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const callbackData = callbackQuery.data; // ex: "approve_15" ou "ignore_15"
    const callbackQueryId = callbackQuery.id;
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    console.log(`[Telegram Listener] Clique recebido: "${callbackData}" do usuário: ${callbackQuery.from.username}`);

    try {
      if (callbackData.startsWith("approve_")) {
        const id = parseInt(callbackData.replace("approve_", ""), 10);
        
        // 1. Busca os dados da otimização no Supabase
        const { data: override, error: fetchErr } = await supabase
          .from("seo_overrides")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (fetchErr || !override) {
          await answerCallback(token, callbackQueryId, "Erro: Otimização não encontrada!");
          return;
        }

        // 2. Atualiza no Supabase para aprovado e pendente de reconstrução
        const { error: updateErr } = await supabase
          .from("seo_overrides")
          .update({
            approved: true,
            rebuilt: false,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (updateErr) {
          console.error("[Telegram Listener] Erro ao aprovar no Supabase:", updateErr.message);
          await answerCallback(token, callbackQueryId, "Erro ao gravar aprovação!");
          return;
        }

        // Responde ao Telegram para remover o loading spinner
        await answerCallback(token, callbackQueryId, "Otimização Aprovada!");

        // 3. Atualiza a mensagem no chat removendo os botões
        const urlPath = override.url.replace(/^https?:\/\/[^\/]+/, "");
        const approvedText = `✅ *Otimização Aprovada e Publicada!*\n\n` +
                             `• *Página:* \`${urlPath}\`\n` +
                             `• *Título Aprovado:* *${override.optimized_title}*\n\n` +
                             `⚙️ O site está sendo reconstruído estaticamente em segundo plano...`;

        await editMessageText(token, chatId, messageId, approvedText);

        // 4. Dispara imediatamente o job de rebuild para compilar o site correspondente
        // Executado de forma assíncrona para não travar a resposta do listener
        runRebuildWebsitesJob().catch(e => {
          console.log("[Telegram Listener] Erro no job de rebuild:", e);
        });

      } else if (callbackData.startsWith("ignore_")) {
        const id = parseInt(callbackData.replace("ignore_", ""), 10);

        // Apenas responde e edita a mensagem
        await answerCallback(token, callbackQueryId, "Otimização Ignorada!");
        await editMessageText(token, chatId, messageId, "❌ *Otimização de SEO Ignorada pelo Usuário*");
      }
    } catch (e: any) {
      console.error("[Telegram Listener] Falha ao processar callback query:", e.message || e);
      await answerCallback(token, callbackQueryId, "Erro ao processar clique!");
    }
  }
}

async function answerCallback(token: string, callbackQueryId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  } catch (e) {
    console.error("[Telegram Listener] Erro no answerCallbackQuery:", e);
  }
}

async function editMessageText(token: string, chatId: number, messageId: number, text: string) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: "Markdown"
      })
    });
  } catch (e) {
    console.error("[Telegram Listener] Erro no editMessageText:", e);
  }
}

import { google } from "googleapis";
import { oauth2Client } from "../config/google";
import { env } from "../config/env";

const indexing = google.indexing({
  version: "v3",
  auth: oauth2Client,
});

/**
  Submete a URL para a Google Indexing API para re-indexação ou remoção rápida.
 */
export async function publishUrlNotification(url: string, type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED") {
  try {
    console.log(`[Google Indexing API] Enviando solicitação ${type} para: ${url}`);
    const res = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    console.log(`[Google Indexing API] Sucesso! Status: ${res.status}. Resposta:`, res.data.urlNotificationMetadata?.latestUpdate?.notifyTime || "OK");
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error(`[Google Indexing API] Falha ao notificar URL ${url}:`, error.message || error);
    return { success: false, error: error.message || error };
  }
}

export const submitUrlToIndexingApi = publishUrlNotification;


/**
  Submete uma lista de URLs para o protocolo IndexNow (compatível com Bing, Yandex, Seznam).
 */
export async function submitIndexNow(host: string, urls: string[], key?: string) {
  // Lê a chave do .env ou usa a chave padrão do projeto
  const indexNowKey = key || (env as any).INDEXNOW_KEY || "antigravityseokey2026";
  const endpoint = "https://api.indexnow.org/indexnow";

  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const keyFileUrl = `https://${cleanHost}/${indexNowKey}.txt`;

  const body = {
    host: cleanHost,
    key: indexNowKey,
    keyLocation: keyFileUrl,
    urlList: urls,
  };

  // Verifica se o arquivo de chave existe no site (requisito do IndexNow)
  try {
    const keyCheck = await fetch(keyFileUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (!keyCheck.ok) {
      console.warn(`[IndexNow] ⚠️ Arquivo de chave não encontrado em ${keyFileUrl}. Crie o arquivo com o conteúdo "${indexNowKey}" para o IndexNow funcionar. Pulando submissão.`);
      return { success: false, error: "Key file not found on site" };
    }
  } catch {
    console.warn(`[IndexNow] ⚠️ Não foi possível verificar ${keyFileUrl}. Tentando submeter mesmo assim...`);
  }

  try {
    console.log(`[IndexNow API] Submetendo ${urls.length} URL(s) para ${cleanHost}...`);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 202) {
      console.log(`[IndexNow API] URLs submetidas com sucesso! (Status: ${res.status})`);
      return { success: true };
    } else {
      const errText = await res.text();
      console.error(`[IndexNow API] Erro ao submeter. Status: ${res.status}. Detalhes: ${errText}`);
      return { success: false, error: errText };
    }
  } catch (error: any) {
    console.error(`[IndexNow API] Erro na requisição IndexNow:`, error.message || error);
    return { success: false, error: error.message || error };
  }
}

import { logEvent } from "./logger";

export type IndexNowPayload = {
  host: string;
  key?: string;
  urlList: string[];
  keyLocation?: string;
};

export type IndexNowResult = {
  success: boolean;
  urlsNotified: number;
  message: string;
};

export async function sendIndexNowPing(payload: IndexNowPayload): Promise<IndexNowResult> {
  const indexNowKey = payload.key || process.env.INDEXNOW_KEY || "8f9a2b4c6e1d3f5a7b9c8d0e1f2a3b4c";
  const endpoint = "https://api.indexnow.org/indexnow";

  if (!payload.urlList || payload.urlList.length === 0) {
    return { success: false, urlsNotified: 0, message: "Nenhuma URL fornecida para notificação no IndexNow." };
  }

  const host = payload.host || payload.urlList[0].replace(/^https?:\/\//, "").split("/")[0];

  const bodyData = {
    host: host,
    key: indexNowKey,
    keyLocation: payload.keyLocation || `https://${host}/${indexNowKey}.txt`,
    urlList: payload.urlList
  };

  try {
    console.log(`[IndexNow Protocol] Enviando ping para ${payload.urlList.length} URL(s) em ${host}...`);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(bodyData)
    });

    if (res.ok || res.status === 200 || res.status === 202) {
      console.log(`[IndexNow Protocol] ✅ ${payload.urlList.length} URL(s) notificadas instantaneamente para Bing/Yandex/DuckDuckGo.`);
      logEvent("system", "INFO", `IndexNow ping enviado com sucesso para ${host}`, {
        payload: { host, urlsNotified: payload.urlList.length }
      });
      return {
        success: true,
        urlsNotified: payload.urlList.length,
        message: `IndexNow notificou ${payload.urlList.length} URL(s) para Bing, DuckDuckGo e Yandex com sucesso.`
      };
    } else {
      const errText = await res.text();
      console.warn(`[IndexNow Protocol] Aviso de resposta do IndexNow (${res.status}): ${errText}`);
      return {
        success: false,
        urlsNotified: 0,
        message: `IndexNow respondeu com status ${res.status}: ${errText}`
      };
    }
  } catch (error: any) {
    console.error(`[IndexNow Protocol] Erro ao disparar IndexNow ping:`, error.message || error);
    return {
      success: false,
      urlsNotified: 0,
      message: `Erro na requisição IndexNow: ${error.message || error}`
    };
  }
}

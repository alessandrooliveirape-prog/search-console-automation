import { supabase } from "../config/supabase";
import { env } from "../config/env";
import { logEvent } from "../services/logger";
import { siteProperties } from "../config/sites";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PublicationStatus =
  | "PENDENTE_APROVAÇÃO"
  | "APROVADO"
  | "PUBLICADO"
  | "IGNORADO"
  | "ERRO";

export type ContentCandidate = {
  siteId: string;
  url: string;
  currentTitle: string;
  optimizedTitle: string;
  optimizedMetaDescription: string;
  mainKeyword: string;
  currentSeoScore: number;
  impressions: number;
  clicks: number;
  position: number;
  type: "TÍTULO_OTIMIZADO" | "NOVO_ARTIGO" | "REPAGINAÇÃO";
  estimatedClickGain: number;
};

export type PublicationRecord = {
  id?: number;
  siteId: string;
  url: string;
  optimizedTitle: string;
  optimizedMetaDescription: string;
  mainKeyword: string;
  status: PublicationStatus;
  type: string;
  estimatedClickGain: number;
  seoScore: number;
  publishedAt?: string;
  telegramMessageId?: number;
  createdAt: string;
};

// ─── Configuração WordPress por site ─────────────────────────────────────────

interface WpSiteConfig {
  siteId: string;
  apiUrl: string;        // ex: https://empregape.com.br/wp-json/wp/v2
  username: string;
  appPassword: string;   // WP Application Password
}

function getWpConfigs(): WpSiteConfig[] {
  const configs: WpSiteConfig[] = [];

  // Emprega PE
  if (process.env.WP_EMPREGAPE_URL && process.env.WP_EMPREGAPE_USER && process.env.WP_EMPREGAPE_PASS) {
    configs.push({
      siteId: "empregape",
      apiUrl: process.env.WP_EMPREGAPE_URL,
      username: process.env.WP_EMPREGAPE_USER,
      appPassword: process.env.WP_EMPREGAPE_PASS,
    });
  }
  // Brasil Calculadoras
  if (process.env.WP_BRASILCALC_URL && process.env.WP_BRASILCALC_USER && process.env.WP_BRASILCALC_PASS) {
    configs.push({
      siteId: "brasilcalculadoras",
      apiUrl: process.env.WP_BRASILCALC_URL,
      username: process.env.WP_BRASILCALC_USER,
      appPassword: process.env.WP_BRASILCALC_PASS,
    });
  }
  // Mestre da Federal
  if (process.env.WP_MESTREFEDERAL_URL && process.env.WP_MESTREFEDERAL_USER && process.env.WP_MESTREFEDERAL_PASS) {
    configs.push({
      siteId: "mestredafederal",
      apiUrl: process.env.WP_MESTREFEDERAL_URL,
      username: process.env.WP_MESTREFEDERAL_USER,
      appPassword: process.env.WP_MESTREFEDERAL_PASS,
    });
  }

  return configs;
}

// ─── Otimizar metadata com Gemini ─────────────────────────────────────────────

async function optimizeCandidateWithGemini(candidate: {
  url: string;
  keyword: string;
  impressions: number;
  position: number;
}): Promise<{ title: string; metaDescription: string }> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      title: `Guia Completo: ${candidate.keyword.slice(0, 50)}`,
      metaDescription: `Tudo sobre ${candidate.keyword}. Informações completas e atualizadas. Acesse agora!`,
    };
  }

  const prompt = `
Você é especialista em SEO e Copywriting pt-BR.
Otimize o Title Tag e Meta Description para a página abaixo.

URL: ${candidate.url}
Palavra-chave principal: "${candidate.keyword}"
Impressões mensais: ${candidate.impressions}
Posição atual: ${candidate.position.toFixed(1)}

Regras:
- Title: máx 60 chars, keyword no início, persuasivo
- Meta Description: máx 155 chars, CTA claro, inclui keyword

Retorne JSON com "title" e "metaDescription".
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                metaDescription: { type: "STRING" },
              },
              required: ["title", "metaDescription"],
            },
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    return {
      title: parsed.title || `Guia: ${candidate.keyword}`,
      metaDescription: parsed.metaDescription || `Saiba tudo sobre ${candidate.keyword}. Acesse agora!`,
    };
  } catch (e: any) {
    console.warn("[Content Publisher] Gemini fallback:", e.message);
    return {
      title: `Guia: ${candidate.keyword.slice(0, 50)}`,
      metaDescription: `Saiba tudo sobre ${candidate.keyword}. Acesse agora!`,
    };
  }
}

// ─── Envio de aprovação via Telegram ─────────────────────────────────────────

async function sendPublisherApprovalRequest(record: PublicationRecord & { dbId: number }): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(`[Content Publisher] Telegram não configurado. Simulando aprovação: "${record.optimizedTitle}"`);
    return null;
  }

  const urlPath = record.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 60);
  const text =
    `📝 *Nova Otimização de Conteúdo para Publicação!*\n\n` +
    `🌐 *Site:* ${record.siteId}\n` +
    `📄 *Página:* \`${urlPath}\`\n` +
    `🔑 *Keyword:* "${record.mainKeyword}"\n` +
    `📈 *Ganho estimado:* +${record.estimatedClickGain} cliques/mês\n\n` +
    `🏆 *Título Otimizado:*\n${record.optimizedTitle}\n\n` +
    `📋 *Meta Description:*\n_${record.optimizedMetaDescription}_\n\n` +
    `Deseja publicar esta otimização?`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Publicar Agora", callback_data: `pub_approve_${record.dbId}` },
            { text: "⏸️ Agendar", callback_data: `pub_schedule_${record.dbId}` },
            { text: "❌ Ignorar", callback_data: `pub_ignore_${record.dbId}` },
          ]],
        },
      }),
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.result?.message_id || null;
  } catch (e: any) {
    console.error("[Content Publisher] Erro ao enviar aprovação:", e.message);
    return null;
  }
}

// ─── Publicar via WordPress REST API ─────────────────────────────────────────

export async function publishToWordPress(
  dbId: number,
  siteId: string
): Promise<{ success: boolean; wpPostId?: number; error?: string }> {
  const wpConfigs = getWpConfigs();
  const wpConfig = wpConfigs.find(c => c.siteId === siteId);

  if (!wpConfig) {
    console.log(`[Content Publisher] WordPress não configurado para ${siteId}. Modo simulação.`);
    // Marca como publicado no Supabase mesmo em simulação
    await supabase.from("bi_content_publications").update({
      status: "PUBLICADO",
      published_at: new Date().toISOString(),
    }).eq("id", dbId);
    return { success: true };
  }

  try {
    // Busca os dados da publicação
    const { data: record } = await supabase
      .from("bi_content_publications")
      .select("*")
      .eq("id", dbId)
      .maybeSingle();

    if (!record) return { success: false, error: "Registro não encontrado" };

    const credentials = Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString("base64");

    // Atualiza o post existente ou cria um novo
    const wpApiUrl = `${wpConfig.apiUrl}/posts`;
    const res = await fetch(wpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title: record.optimized_title,
        excerpt: record.optimized_meta_description,
        status: "publish",
        meta: {
          _yoast_wpseo_title: record.optimized_title,
          _yoast_wpseo_metadesc: record.optimized_meta_description,
          _aioseo_title: record.optimized_title,
          _aioseo_description: record.optimized_meta_description,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Content Publisher] WP API error:", errText.slice(0, 200));
      await supabase.from("bi_content_publications").update({ status: "ERRO" }).eq("id", dbId);
      return { success: false, error: `WP API Error: ${res.status}` };
    }

    const wpData: any = await res.json();
    const wpPostId = wpData.id;

    await supabase.from("bi_content_publications").update({
      status: "PUBLICADO",
      published_at: new Date().toISOString(),
    }).eq("id", dbId);

    console.log(`[Content Publisher] ✅ Publicado no WordPress (Post ID: ${wpPostId})`);
    return { success: true, wpPostId };
  } catch (e: any) {
    console.error("[Content Publisher] Erro ao publicar no WP:", e.message);
    await supabase.from("bi_content_publications").update({ status: "ERRO" }).eq("id", dbId);
    return { success: false, error: e.message };
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function runContentPublisher(): Promise<{ candidatesFound: number; requestsSent: number }> {
  console.log("[Content Publisher 5.0] Identificando candidatos para publicação/otimização...");
  let candidatesFound = 0;
  let requestsSent = 0;

  for (const site of siteProperties) {
    // Busca top keywords com baixo CTR e boa posição (candidatas a otimização de título)
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: kwData } = await supabase
      .from("gsc_performance")
      .select("page, query, impressions, clicks, position, ctr")
      .eq("site_id", site.id)
      .gte("date", since.toISOString().slice(0, 10))
      .gte("impressions", 100)
      .lte("position", 15)
      .gt("position", 1)
      .order("impressions", { ascending: false })
      .limit(100);

    if (!kwData || kwData.length === 0) continue;

    // Agrega por página
    const pageMap: Record<string, { clicks: number; impressions: number; position: number; query: string; count: number }> = {};
    for (const r of kwData) {
      const p = r.page || "";
      if (!pageMap[p]) pageMap[p] = { clicks: 0, impressions: 0, position: 0, query: r.query || "", count: 0 };
      pageMap[p].clicks += r.clicks || 0;
      pageMap[p].impressions += r.impressions || 0;
      pageMap[p].position += r.position || 0;
      pageMap[p].count++;
      if ((r.impressions || 0) > pageMap[p].impressions / 2) {
        pageMap[p].query = r.query || pageMap[p].query;
      }
    }

    // Filtra candidatos (CTR < 3% e posição ≤ 15)
    const candidates = Object.entries(pageMap)
      .filter(([, s]) => {
        const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
        const avgPos = s.position / s.count;
        return ctr < 0.03 && avgPos <= 15 && s.impressions >= 100;
      })
      .map(([url, s]) => ({
        url,
        keyword: s.query,
        impressions: s.impressions,
        clicks: s.clicks,
        position: s.position / s.count,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3); // Máx 3 candidatos por site por execução

    candidatesFound += candidates.length;

    for (const candidate of candidates) {
      // Verifica se já existe aprovação pendente para esta URL
      const { data: existing } = await supabase
        .from("bi_content_publications")
        .select("id, status")
        .eq("site_id", site.id)
        .eq("url", candidate.url)
        .in("status", ["PENDENTE_APROVAÇÃO", "APROVADO"])
        .maybeSingle();

      if (existing) {
        console.log(`[Content Publisher] ${candidate.url} já tem aprovação pendente. Pulando.`);
        continue;
      }

      // Otimiza com Gemini
      const optimized = await optimizeCandidateWithGemini(candidate);

      const targetCtr = candidate.position <= 4 ? 0.08 : candidate.position <= 8 ? 0.05 : 0.03;
      const currentCtr = candidate.impressions > 0 ? candidate.clicks / candidate.impressions : 0;
      const estimatedGain = Math.max(0, Math.round((targetCtr - currentCtr) * candidate.impressions));

      // Salva no Supabase
      const { data: inserted, error } = await supabase
        .from("bi_content_publications")
        .insert({
          site_id: site.id,
          url: candidate.url,
          optimized_title: optimized.title,
          optimized_meta_description: optimized.metaDescription,
          main_keyword: candidate.keyword,
          status: "PENDENTE_APROVAÇÃO",
          type: "TÍTULO_OTIMIZADO",
          estimated_click_gain: estimatedGain,
          seo_score: 0,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (error || !inserted) {
        console.error("[Content Publisher] Erro ao salvar candidato:", error?.message);
        continue;
      }

      const record: PublicationRecord & { dbId: number } = {
        dbId: inserted.id,
        siteId: site.id,
        url: candidate.url,
        optimizedTitle: optimized.title,
        optimizedMetaDescription: optimized.metaDescription,
        mainKeyword: candidate.keyword,
        status: "PENDENTE_APROVAÇÃO",
        type: "TÍTULO_OTIMIZADO",
        estimatedClickGain: estimatedGain,
        seoScore: 0,
        createdAt: new Date().toISOString(),
      };

      // Envia para aprovação via Telegram
      const msgId = await sendPublisherApprovalRequest(record);
      if (msgId) {
        await supabase.from("bi_content_publications")
          .update({ telegram_message_id: msgId })
          .eq("id", inserted.id);
      }

      requestsSent++;
      console.log(`[Content Publisher] Aprovação enviada para: ${candidate.url} (+${estimatedGain} cliques estimados)`);
    }
  }

  logEvent("system", "INFO", `[Content Publisher 5.0] ${candidatesFound} candidatos | ${requestsSent} aprovações enviadas`, {
    payload: { candidatesFound, requestsSent }
  });

  return { candidatesFound, requestsSent };
}

// ─── Buscar publicações recentes (Dashboard) ──────────────────────────────────

export async function fetchRecentPublications(siteId: string, limit = 20): Promise<PublicationRecord[]> {
  try {
    const { data } = await supabase
      .from("bi_content_publications")
      .select("*")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      siteId: r.site_id,
      url: r.url,
      optimizedTitle: r.optimized_title,
      optimizedMetaDescription: r.optimized_meta_description,
      mainKeyword: r.main_keyword,
      status: r.status as PublicationStatus,
      type: r.type,
      estimatedClickGain: r.estimated_click_gain,
      seoScore: r.seo_score,
      publishedAt: r.published_at || undefined,
      telegramMessageId: r.telegram_message_id || undefined,
      createdAt: r.created_at,
    }));
  } catch (e: any) {
    console.warn("[Content Publisher] Erro ao buscar publicações:", e.message);
    return [];
  }
}

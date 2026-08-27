import { supabase } from "../config/supabase";
import { env } from "../config/env";
import { logEvent } from "../services/logger";
import { siteProperties } from "../config/sites";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EditorialSlotType = "NOVO" | "ATUALIZAÇÃO" | "REPAGINAÇÃO" | "SÉRIE";

export type EditorialPriority = "URGENTE" | "ALTA" | "MÉDIA" | "BAIXA";

export type EditorialSlot = {
  siteId: string;
  suggestedDate: string;          // ISO date: YYYY-MM-DD
  title: string;                  // Título sugerido do artigo
  mainKeyword: string;            // Keyword principal alvo
  secondaryKeywords: string[];    // Keywords secundárias relacionadas
  type: EditorialSlotType;
  priority: EditorialPriority;
  estimatedClicks: number;        // Ganho estimado de cliques/mês
  justification: string;         // Justificativa da IA
  targetUrl?: string;             // URL existente (para atualização/repaginação)
  cluster: string;                // Cluster temático
};

export type EditorialCalendar = {
  siteId: string;
  generatedAt: string;
  month: string;              // "2026-08"
  totalSlots: number;
  slots: EditorialSlot[];
};

// ─── Gemini: Geração de pauta mensal ─────────────────────────────────────────

async function generatePautaWithGemini(
  siteId: string,
  siteName: string,
  keywordGaps: Array<{ keyword: string; impressions: number; clicks: number; position: number }>,
  stagnantPages: Array<{ url: string; title?: string; impressions: number }>,
  targetMonth: string
): Promise<EditorialSlot[]> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Editorial Calendar] Gemini API Key não configurada. Usando pauta local.");
    return generateLocalPauta(siteId, keywordGaps, stagnantPages, targetMonth);
  }

  const gapsText = keywordGaps
    .slice(0, 15)
    .map(k => `- "${k.keyword}" (${k.impressions} impressões, pos. ${k.position.toFixed(1)}, apenas ${k.clicks} cliques)`)
    .join("\n");

  const stagnantText = stagnantPages
    .slice(0, 10)
    .map(p => `- ${p.url} (${p.impressions} impressões/mês)`)
    .join("\n");

  const prompt = `
Você é um estrategista de conteúdo SEO especialista em SEO brasileiro.

Site: "${siteName}" (ID: ${siteId})
Mês alvo: ${targetMonth}

Palavras-chave com alto potencial (muitas impressões, baixo CTR, posições 4-20):
${gapsText}

Páginas estagnadas que precisam de atualização:
${stagnantText}

Com base nesses dados, crie um Calendário Editorial mensal com 8 a 12 slots de conteúdo.
Para cada slot, defina:
- suggestedDate: data no mês ${targetMonth} (formato YYYY-MM-DD), distribuídas ao longo do mês
- title: título otimizado em pt-BR (max 60 chars)
- mainKeyword: palavra-chave principal do slot
- secondaryKeywords: array com 2-3 keywords secundárias
- type: "NOVO", "ATUALIZAÇÃO", "REPAGINAÇÃO" ou "SÉRIE"
- priority: "URGENTE", "ALTA", "MÉDIA" ou "BAIXA"
- estimatedClicks: ganho estimado de cliques mensais após publicação
- justification: justificativa estratégica em 1-2 frases
- cluster: categoria temática (ex: "Vagas de Emprego", "Calculadoras", "Ferramentas")

Retorne estritamente um JSON com a chave "slots" contendo o array.
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
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
                slots: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      suggestedDate: { type: "STRING" },
                      title: { type: "STRING" },
                      mainKeyword: { type: "STRING" },
                      secondaryKeywords: { type: "ARRAY", items: { type: "STRING" } },
                      type: { type: "STRING" },
                      priority: { type: "STRING" },
                      estimatedClicks: { type: "NUMBER" },
                      justification: { type: "STRING" },
                      cluster: { type: "STRING" },
                      targetUrl: { type: "STRING" },
                    },
                    required: ["suggestedDate", "title", "mainKeyword", "type", "priority", "estimatedClicks", "justification", "cluster"],
                  },
                },
              },
              required: ["slots"],
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Editorial Calendar] Gemini API error:", errText.slice(0, 200));
      return generateLocalPauta(siteId, keywordGaps, stagnantPages, targetMonth);
    }

    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return generateLocalPauta(siteId, keywordGaps, stagnantPages, targetMonth);

    const parsed = JSON.parse(text);
    const rawSlots: any[] = parsed.slots || [];

    return rawSlots.map((s: any) => ({
      siteId,
      suggestedDate: s.suggestedDate || `${targetMonth}-01`,
      title: s.title || "Artigo sem título",
      mainKeyword: s.mainKeyword || "",
      secondaryKeywords: Array.isArray(s.secondaryKeywords) ? s.secondaryKeywords : [],
      type: (s.type as EditorialSlotType) || "NOVO",
      priority: (s.priority as EditorialPriority) || "MÉDIA",
      estimatedClicks: Number(s.estimatedClicks) || 0,
      justification: s.justification || "",
      targetUrl: s.targetUrl || undefined,
      cluster: s.cluster || "Outros",
    }));
  } catch (e: any) {
    console.error("[Editorial Calendar] Erro ao chamar Gemini:", e.message);
    return generateLocalPauta(siteId, keywordGaps, stagnantPages, targetMonth);
  }
}

// ─── Fallback local (sem API Gemini) ─────────────────────────────────────────

function generateLocalPauta(
  siteId: string,
  keywordGaps: Array<{ keyword: string; impressions: number; clicks: number; position: number }>,
  stagnantPages: Array<{ url: string; impressions: number }>,
  targetMonth: string
): EditorialSlot[] {
  const slots: EditorialSlot[] = [];
  const [year, month] = targetMonth.split("-").map(Number);

  // Gera slots para keywords de alto potencial
  const top5Gaps = keywordGaps.slice(0, 5);
  top5Gaps.forEach((kw, i) => {
    const day = String(Math.min(28, (i + 1) * 5)).padStart(2, "0");
    slots.push({
      siteId,
      suggestedDate: `${year}-${String(month).padStart(2, "0")}-${day}`,
      title: `Guia Completo: ${kw.keyword.slice(0, 45)}`,
      mainKeyword: kw.keyword,
      secondaryKeywords: [],
      type: "NOVO",
      priority: kw.impressions > 1000 ? "URGENTE" : "ALTA",
      estimatedClicks: Math.round(kw.impressions * 0.05),
      justification: `Keyword com ${kw.impressions} impressões e CTR baixo (pos. ${kw.position.toFixed(1)}). Alto potencial de ganho.`,
      cluster: "Outros",
    });
  });

  // Gera slots para páginas estagnadas
  const top3Stagnant = stagnantPages.slice(0, 3);
  top3Stagnant.forEach((page, i) => {
    const day = String(Math.min(28, (i + 1) * 7)).padStart(2, "0");
    const slug = page.url.replace(/^https?:\/\/[^/]+/, "").replace(/\//g, "-").slice(1, 40);
    slots.push({
      siteId,
      suggestedDate: `${year}-${String(month).padStart(2, "0")}-${day}`,
      title: `Atualização: ${slug}`,
      mainKeyword: slug.replace(/-/g, " "),
      secondaryKeywords: [],
      type: "ATUALIZAÇÃO",
      priority: "MÉDIA",
      estimatedClicks: Math.round(page.impressions * 0.02),
      justification: `Página estagnada com ${page.impressions} impressões. Atualização pode recuperar ranqueamento.`,
      targetUrl: page.url,
      cluster: "Outros",
    });
  });

  return slots;
}

// ─── Salvar no Supabase ───────────────────────────────────────────────────────

async function saveCalendarToSupabase(calendar: EditorialCalendar): Promise<void> {
  try {
    // Apaga pauta do mesmo mês/site antes de reinserir
    await supabase
      .from("bi_editorial_calendar")
      .delete()
      .eq("site_id", calendar.siteId)
      .eq("month", calendar.month);

    if (calendar.slots.length === 0) return;

    const rows = calendar.slots.map(slot => ({
      site_id: slot.siteId,
      month: calendar.month,
      suggested_date: slot.suggestedDate,
      title: slot.title,
      main_keyword: slot.mainKeyword,
      secondary_keywords: slot.secondaryKeywords,
      type: slot.type,
      priority: slot.priority,
      estimated_clicks: slot.estimatedClicks,
      justification: slot.justification,
      target_url: slot.targetUrl || null,
      cluster: slot.cluster,
      generated_at: calendar.generatedAt,
      status: "PENDENTE",
    }));

    await supabase.from("bi_editorial_calendar").insert(rows);
    console.log(`[Editorial Calendar] ${rows.length} slots salvos para ${calendar.siteId} (${calendar.month}).`);
  } catch (e: any) {
    console.warn("[Editorial Calendar] Erro ao salvar no Supabase (tabela pode não existir):", e.message);
  }
}

// ─── Buscar dados de keywords e páginas estagnadas ──────────────────────────

async function fetchKeywordGaps(siteId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data } = await supabase
    .from("gsc_performance")
    .select("query, impressions, clicks, position")
    .eq("site_id", siteId)
    .gte("date", since.toISOString().slice(0, 10))
    .gte("impressions", 50)
    .lte("position", 20)
    .gt("position", 3)
    .order("impressions", { ascending: false })
    .limit(50);

  if (!data) return [];

  // Agrega por query
  const map: Record<string, { impressions: number; clicks: number; position: number; count: number }> = {};
  for (const r of data) {
    const q = r.query || "";
    if (!map[q]) map[q] = { impressions: 0, clicks: 0, position: 0, count: 0 };
    map[q].impressions += r.impressions || 0;
    map[q].clicks += r.clicks || 0;
    map[q].position += r.position || 0;
    map[q].count++;
  }

  return Object.entries(map)
    .map(([keyword, stats]) => ({
      keyword,
      impressions: stats.impressions,
      clicks: stats.clicks,
      position: stats.position / stats.count,
    }))
    .filter(k => {
      const ctr = k.impressions > 0 ? k.clicks / k.impressions : 0;
      return ctr < 0.04; // CTR abaixo de 4% = gap de CTR
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

async function fetchStagnantPages(siteId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await supabase
    .from("gsc_performance")
    .select("page, impressions, clicks")
    .eq("site_id", siteId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("impressions", { ascending: false })
    .limit(200);

  if (!data) return [];

  const pageMap: Record<string, { impressions: number; clicks: number }> = {};
  for (const r of data) {
    const p = r.page || "";
    if (!pageMap[p]) pageMap[p] = { impressions: 0, clicks: 0 };
    pageMap[p].impressions += r.impressions || 0;
    pageMap[p].clicks += r.clicks || 0;
  }

  return Object.entries(pageMap)
    .filter(([, stats]) => {
      const ctr = stats.impressions > 0 ? stats.clicks / stats.impressions : 0;
      return ctr < 0.02 && stats.impressions > 100; // Estagnada = CTR < 2% com volume
    })
    .map(([url, stats]) => ({ url, impressions: stats.impressions }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function generateEditorialCalendar(
  targetMonth?: string
): Promise<EditorialCalendar[]> {
  const now = new Date();
  // Pauta para o próximo mês
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthStr = targetMonth || `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  console.log(`[Editorial Calendar 5.0] Gerando pauta editorial para ${monthStr}...`);
  const calendars: EditorialCalendar[] = [];

  for (const site of siteProperties) {
    const [keywordGaps, stagnantPages] = await Promise.all([
      fetchKeywordGaps(site.id),
      fetchStagnantPages(site.id),
    ]);

    if (keywordGaps.length === 0 && stagnantPages.length === 0) {
      console.log(`[Editorial Calendar] Sem dados suficientes para ${site.name}.`);
      continue;
    }

    const slots = await generatePautaWithGemini(
      site.id,
      site.name,
      keywordGaps,
      stagnantPages,
      monthStr
    );

    const calendar: EditorialCalendar = {
      siteId: site.id,
      generatedAt: new Date().toISOString(),
      month: monthStr,
      totalSlots: slots.length,
      slots,
    };

    await saveCalendarToSupabase(calendar);
    calendars.push(calendar);
    console.log(`[Editorial Calendar] ${site.name}: ${slots.length} slots gerados.`);
  }

  logEvent("system", "INFO", `[Editorial Calendar 5.0] Pauta gerada para ${monthStr}`, {
    payload: {
      month: monthStr,
      sitesCount: calendars.length,
      totalSlots: calendars.reduce((a, c) => a + c.totalSlots, 0),
    }
  });

  return calendars;
}

// ─── Buscar pauta do Supabase (para o Dashboard) ─────────────────────────────

export async function fetchEditorialCalendar(
  siteId: string,
  month?: string
): Promise<EditorialSlot[]> {
  const targetMonth = month || (() => {
    const n = new Date();
    const nm = new Date(n.getFullYear(), n.getMonth() + 1, 1);
    return `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}`;
  })();

  try {
    const { data } = await supabase
      .from("bi_editorial_calendar")
      .select("*")
      .eq("site_id", siteId)
      .eq("month", targetMonth)
      .order("suggested_date", { ascending: true });

    if (!data || data.length === 0) return [];

    return data.map((r: any) => ({
      siteId: r.site_id,
      suggestedDate: r.suggested_date,
      title: r.title,
      mainKeyword: r.main_keyword,
      secondaryKeywords: r.secondary_keywords || [],
      type: r.type as EditorialSlotType,
      priority: r.priority as EditorialPriority,
      estimatedClicks: r.estimated_clicks,
      justification: r.justification,
      targetUrl: r.target_url || undefined,
      cluster: r.cluster,
    }));
  } catch (e: any) {
    console.warn("[Editorial Calendar] Erro ao buscar pauta:", e.message);
    return [];
  }
}

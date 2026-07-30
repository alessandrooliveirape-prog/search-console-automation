import { supabase } from "../config/supabase";
import { siteProperties } from "../config/sites";
import { logEvent } from "../services/logger";

export type SchemaType = "FAQPage" | "Article" | "JobPosting" | "HowTo" | "Product";

export type SchemaSnippetItem = {
  id?: number;
  siteId: string;
  url: string;
  keyword: string;
  currentPosition: number;
  impressions: number;
  clicks: number;
  schemaType: SchemaType;
  jsonLdCode: string;
  structuredTextSnippet: string;
  potentialClickGain: number;
  createdAt: string;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateFaqJsonLd(keyword: string, url: string): string {
  const cleanKw = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": `O que é ${cleanKw}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Confira todas as informações completas e atualizadas sobre ${cleanKw} em nosso portal.`
          }
        },
        {
          "@type": "Question",
          "name": `Como funciona ${cleanKw}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Acesse nosso guia passo a passo em ${url} para tirar todas as dúvidas.`
          }
        }
      ]
    },
    null,
    2
  );
}

function generateArticleJsonLd(keyword: string, url: string): string {
  const cleanKw = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": `${cleanKw}: Guia Completo e Atualizado`,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": url
      },
      "author": {
        "@type": "Organization",
        "name": "Editorial SEO Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Portal SEO"
      },
      "description": `Artigo especializado cobrindo ${cleanKw}.`
    },
    null,
    2
  );
}

function generateJobPostingJsonLd(keyword: string, url: string): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": `Vaga de Emprego: ${keyword.toUpperCase()}`,
      "description": `Oportunidade urgente para ${keyword}. Envie seu currículo e inscreva-se.`,
      "directApply": true,
      "url": url,
      "datePosted": formatDate(new Date()),
      "hiringOrganization": {
        "@type": "Organization",
        "name": "Portal de Vagas"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressRegion": "PE",
          "addressCountry": "BR"
        }
      }
    },
    null,
    2
  );
}

export async function runSchemaSnippetGenerator(): Promise<SchemaSnippetItem[]> {
  console.log("[Schema & Position 0 Generator 6.0] Buscando páginas elegíveis para Featured Snippets...");
  const snippets: SchemaSnippetItem[] = [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);

  for (const site of siteProperties) {
    try {
      const { data: rows } = await supabase
        .from("gsc_performance")
        .select("query, page, clicks, impressions, ctr, position")
        .eq("site_id", site.id)
        .gte("date", formatDate(sinceDate))
        .gte("impressions", 30)
        .gte("position", 2.0)
        .lte("position", 8.5)
        .order("impressions", { ascending: false })
        .limit(60);

      if (!rows || rows.length === 0) continue;

      const processedMap = new Set<string>();

      for (const r of rows) {
        const q = (r.query || "").trim().toLowerCase();
        const p = r.page;
        if (!q || !p || processedMap.has(`${site.id}-${q}`)) continue;

        processedMap.add(`${site.id}-${q}`);

        const isJob = p.includes("/vaga/") || q.includes("vaga") || q.includes("emprego");
        const isFaq = q.includes("como") || q.includes("o que") || q.includes("qual") || q.includes("quanto") || q.includes("como calcular");

        let schemaType: SchemaType = "Article";
        let jsonLdCode = "";

        if (isJob) {
          schemaType = "JobPosting";
          jsonLdCode = generateJobPostingJsonLd(q, p);
        } else if (isFaq) {
          schemaType = "FAQPage";
          jsonLdCode = generateFaqJsonLd(q, p);
        } else {
          schemaType = "Article";
          jsonLdCode = generateArticleJsonLd(q, p);
        }

        const cleanKw = q.charAt(0).toUpperCase() + q.slice(1);
        const structuredTextSnippet =
          `## O que é ${cleanKw}?\n` +
          `${cleanKw} é a solução ideal para quem busca informação rápida e precisa. ` +
          `Para acessar a versão completa e realizar atualizações, confira os passos abaixo:\n\n` +
          `1. Acesse o portal ${p}\n` +
          `2. Verifique os dados atualizados para ${q}\n` +
          `3. Siga as instruções detalhadas no artigo.`;

        const targetCtr = r.position <= 3 ? 0.12 : 0.08;
        const currentCtr = r.impressions > 0 ? (r.clicks || 0) / r.impressions : 0;
        const potentialClickGain = Math.max(0, Math.round((targetCtr - currentCtr) * r.impressions));

        const item: SchemaSnippetItem = {
          siteId: site.id,
          url: p,
          keyword: q,
          currentPosition: Number((r.position || 0).toFixed(1)),
          impressions: r.impressions || 0,
          clicks: r.clicks || 0,
          schemaType,
          jsonLdCode,
          structuredTextSnippet,
          potentialClickGain,
          createdAt: new Date().toISOString()
        };

        try {
          await supabase.from("bi_schema_snippets").upsert({
            site_id: item.siteId,
            url: item.url,
            keyword: item.keyword,
            current_position: item.currentPosition,
            impressions: item.impressions,
            clicks: item.clicks,
            schema_type: item.schemaType,
            json_ld_code: item.jsonLdCode,
            structured_text_snippet: item.structuredTextSnippet,
            potential_click_gain: item.potentialClickGain,
            created_at: item.createdAt
          }, { onConflict: "site_id,url,keyword" });
        } catch (err: any) {
          console.warn("[Schema Generator] Aviso ao salvar no Supabase:", err.message);
        }

        snippets.push(item);
      }
    } catch (e: any) {
      console.error(`[Schema Generator] Erro no site ${site.id}:`, e.message);
    }
  }

  logEvent("system", "INFO", `[Schema & Position 0 Generator 6.0] ${snippets.length} oportunidades de Rich Snippets geradas`, {
    payload: { totalSnippets: snippets.length }
  });

  return snippets;
}

export async function fetchSchemaSnippets(siteId: string): Promise<SchemaSnippetItem[]> {
  try {
    const { data } = await supabase
      .from("bi_schema_snippets")
      .select("*")
      .eq("site_id", siteId)
      .order("potential_click_gain", { ascending: false });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      siteId: r.site_id,
      url: r.url,
      keyword: r.keyword,
      currentPosition: r.current_position,
      impressions: r.impressions,
      clicks: r.clicks,
      schemaType: r.schema_type as SchemaType,
      jsonLdCode: r.json_ld_code,
      structuredTextSnippet: r.structured_text_snippet,
      potentialClickGain: r.potential_click_gain,
      createdAt: r.created_at
    }));
  } catch (e: any) {
    console.warn("[Schema Generator] Erro ao buscar snippets do Supabase:", e.message);
    return [];
  }
}

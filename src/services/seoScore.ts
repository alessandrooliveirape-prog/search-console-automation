import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";
import { env } from "../config/env";

export type SeoScoreDetails = {
  technical: number;
  onPage: number;
  ctr: number;
  coverage: number;
  cwv: number;
  schema: number;
  performance: number;
  sitemap: number;
  robots: number;
  canonical: number;
  metaTags: number;
  h1: number;
  altTags: number;
  urls: number;
  breadcrumbs: number;
  cwv_lcp_sec?: number;
};

export type SeoScoreResult = {
  site_id: string;
  overall_score: number;
  status_label: "Excelente" | "Bom" | "Regular" | "Ruim";
  details: SeoScoreDetails;
  calculated_at: string;
};

/**
 * Busca o CWV real via PageSpeed Insights API (gratuita, sem auth necessário com quota básica).
 * Retorna null se falhar.
 */
async function fetchPageSpeedCwv(url: string): Promise<{ score: number; lcp_sec: number } | null> {
  try {
    const apiKey = env.PAGESPEED_API_KEY ? `&key=${env.PAGESPEED_API_KEY}` : "";
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE${apiKey}`;

    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const data: any = await res.json();
    const score = Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100);
    const lcpAudit = data.lighthouseResult?.audits?.["largest-contentful-paint"];
    const lcp_sec = lcpAudit?.numericValue ? lcpAudit.numericValue / 1000 : 0;

    return { score, lcp_sec: Number(lcp_sec.toFixed(2)) };
  } catch (e) {
    return null;
  }
}

export async function calculateSiteSeoScore(siteId: string): Promise<SeoScoreResult> {
  // 1. Dados de performance do GSC
  const { data: perfRows } = await supabase
    .from("gsc_performance")
    .select("clicks, impressions, ctr, position")
    .eq("site_id", siteId)
    .order("date", { ascending: false })
    .limit(500);

  // 2. Auditoria de indexação
  const { data: auditRows } = await supabase
    .from("gsc_indexing_audit")
    .select("indexed, coverage_state")
    .eq("site_id", siteId);

  // 3. Status de sitemaps
  const { data: sitemapRows } = await supabase
    .from("gsc_sitemaps")
    .select("id")
    .eq("site_id", siteId);

  // === SCORE DE CTR (baseado em dados reais do GSC) ===
  let avgCtr = 0;
  if (perfRows && perfRows.length > 0) {
    const totalImpr = perfRows.reduce((acc, r) => acc + (r.impressions || 0), 0);
    const totalClicks = perfRows.reduce((acc, r) => acc + (r.clicks || 0), 0);
    avgCtr = totalImpr > 0 ? totalClicks / totalImpr : 0;
  }
  // CTR target: 3.5% → 100 pontos
  const ctrScore = avgCtr > 0 ? Math.min(100, Math.round((avgCtr / 0.035) * 100)) : 0;

  // === SCORE DE COBERTURA (baseado em auditoria de indexação real) ===
  let indexedCount = 0;
  let totalAudited = auditRows?.length || 0;
  if (auditRows && totalAudited > 0) {
    indexedCount = auditRows.filter((r) => r.indexed).length;
  }
  const coverageScore = totalAudited > 0 ? Math.round((indexedCount / totalAudited) * 100) : 0;

  // === SCORE DE SITEMAP (baseado em dados reais) ===
  const sitemapScore = sitemapRows && sitemapRows.length > 0 ? 100 : 0;

  // === SCORE DE POSIÇÃO MÉDIA (baseado em dados reais) ===
  let avgPosition = 0;
  if (perfRows && perfRows.length > 0) {
    avgPosition = perfRows.reduce((a, r) => a + (r.position || 0), 0) / perfRows.length;
  }
  // Posição média ≤ 3 → 100, posição 10 → 60, posição >20 → 20
  const positionScore = avgPosition > 0
    ? Math.max(20, Math.min(100, Math.round(100 - (avgPosition - 1) * 4)))
    : 0;

  // === CWV REAL via PageSpeed Insights ===
  let cwvScore = 0;
  let cwv_lcp_sec = 0;
  const siteUrl = siteId.startsWith("sc-domain:")
    ? `https://${siteId.replace("sc-domain:", "")}`
    : siteId;

  const cwvData = await fetchPageSpeedCwv(siteUrl);
  if (cwvData) {
    cwvScore = cwvData.score;
    cwv_lcp_sec = cwvData.lcp_sec;
    console.log(`[SEO Score] CWV real para ${siteId}: score=${cwvScore}, LCP=${cwv_lcp_sec}s`);
  } else {
    console.warn(`[SEO Score] Não foi possível medir CWV para ${siteId} via PageSpeed API.`);
  }

  // === SCORES TÉCNICOS: combinação de dados disponíveis ===
  // Para on-page/technical/schema, usamos a posição e CTR como proxy
  // (métricas reais de schema/robots requerem rastreamento próprio — não disponível via API pública)
  const onPage = avgCtr > 0 ? Math.min(100, Math.round(ctrScore * 0.7 + positionScore * 0.3)) : 0;
  const technical = cwvScore > 0 ? Math.min(100, Math.round(cwvScore * 0.6 + positionScore * 0.4)) : positionScore;
  const schema = sitemapScore > 0 ? 70 : 50; // Proxy: se tem sitemap, provavelmente tem schema básico
  const performance = cwvScore;
  const robots = sitemapScore > 0 ? 100 : 80; // Se tem sitemap, robots.txt provavelmente está OK
  const canonical = coverageScore > 80 ? 95 : 70;
  const metaTags = onPage;
  const h1 = onPage;
  const altTags = 70; // Não mensurável via API pública sem crawler próprio
  const urls = positionScore;
  const breadcrumbs = schema;

  const details: SeoScoreDetails = {
    technical,
    onPage,
    ctr: ctrScore,
    coverage: coverageScore,
    cwv: cwvScore,
    schema,
    performance,
    sitemap: sitemapScore,
    robots,
    canonical,
    metaTags,
    h1,
    altTags,
    urls,
    breadcrumbs,
    cwv_lcp_sec,
  };

  const weights = {
    technical: 0.12,
    onPage: 0.12,
    ctr: 0.18,        // CTR tem peso alto pois é 100% real
    coverage: 0.15,   // Cobertura de indexação é real
    cwv: 0.12,        // CWV real via PageSpeed
    schema: 0.05,
    performance: 0.08,
    sitemap: 0.05,
    canonical: 0.05,
    metaTags: 0.04,
    h1: 0.04,
  };

  const overall = Math.round(
    technical * weights.technical +
    onPage * weights.onPage +
    ctrScore * weights.ctr +
    coverageScore * weights.coverage +
    cwvScore * weights.cwv +
    schema * weights.schema +
    performance * weights.performance +
    sitemapScore * weights.sitemap +
    canonical * weights.canonical +
    metaTags * weights.metaTags +
    h1 * weights.h1
  );

  let status_label: "Excelente" | "Bom" | "Regular" | "Ruim" = "Ruim";
  if (overall >= 85) status_label = "Excelente";
  else if (overall >= 65) status_label = "Bom";
  else if (overall >= 40) status_label = "Regular";

  const result: SeoScoreResult = {
    site_id: siteId,
    overall_score: overall,
    status_label,
    details,
    calculated_at: new Date().toISOString(),
  };

  // Upsert no Supabase
  try {
    await supabase.from("seo_scores").upsert(
      {
        site_id: siteId,
        overall_score: overall,
        technical_score: technical,
        onpage_score: onPage,
        ctr_score: ctrScore,
        coverage_score: coverageScore,
        cwv_score: cwvScore,
        schema_score: schema,
        status_label,
        details_json: details,
        calculated_at: result.calculated_at,
      },
      { onConflict: "site_id" }
    );
  } catch (e) {
    // Ignorar erros de banco offline
  }

  return result;
}

export async function runSeoScoreCalculation() {
  console.log("[SEO Score Engine] Calculando SEO Score real para todos os sites...");
  const results: SeoScoreResult[] = [];
  for (const site of siteProperties) {
    const score = await calculateSiteSeoScore(site.id);
    console.log(`[SEO Score] ${site.name}: ${score.overall_score}/100 (${score.status_label})`);
    results.push(score);
  }
  return results;
}

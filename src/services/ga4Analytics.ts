import { google } from "googleapis";
import { oauth2Client } from "../config/google";
import { env } from "../config/env";
import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";

export type Ga4Metrics = {
  site_id: string;
  date: string;
  users: number;
  sessions: number;
  new_users: number;
  avg_duration_sec: number;
  bounce_rate: number;
  page_views: number;
  conversions: number;
  engagement_rate: number;
  top_sources: { source: string; users: number }[];
  top_devices: { device: string; percentage: number }[];
  top_countries: { country: string; users: number }[];
};

/**
 * Cria o cliente GA4 Data API com a melhor autenticação disponível:
 * 1. Service Account (GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY) — método preferido
 * 2. OAuth2 (GOOGLE_REFRESH_TOKEN) — fallback
 */
function createAnalyticsClient() {
  if (env.GA4_CLIENT_EMAIL && env.GA4_PRIVATE_KEY) {
    // Service Account — não requer interação do usuário, mais confiável
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: env.GA4_CLIENT_EMAIL,
        private_key: env.GA4_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    console.log("[GA4] Usando autenticação por Service Account.");
    return google.analyticsdata({ version: "v1beta", auth });
  }

  // Fallback: OAuth2 (o mesmo token do Search Console)
  console.log("[GA4] Usando autenticação OAuth2.");
  return google.analyticsdata({ version: "v1beta", auth: oauth2Client });
}

export async function fetchGa4AnalyticsForSite(
  siteId: string,
  ga4PropertyId?: string
): Promise<Ga4Metrics | null> {
  const dateStr = new Date().toISOString().slice(0, 10);

  if (!ga4PropertyId) {
    console.warn(`[GA4] Sem GA4_PROPERTY_ID configurado para ${siteId}. Pulando.`);
    return null;
  }

  const analyticsdata = createAnalyticsClient();

  try {
    // Busca métricas principais
    const mainReport = await analyticsdata.properties.runReport({
      property: ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "newUsers" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "screenPageViews" },
          { name: "conversions" },
          { name: "engagementRate" },
        ],
        dimensions: [],
      },
    });

    const row = (mainReport as any).data?.rows?.[0]?.metricValues;
    const users = row ? parseInt(row[0]?.value || "0") : 0;
    const sessions = row ? parseInt(row[1]?.value || "0") : 0;
    const new_users = row ? parseInt(row[2]?.value || "0") : 0;
    const avg_duration_sec = row ? Math.round(parseFloat(row[3]?.value || "0")) : 0;
    const bounce_rate = row ? Number(parseFloat(row[4]?.value || "0").toFixed(1)) : 0;
    const page_views = row ? parseInt(row[5]?.value || "0") : 0;
    const conversions = row ? parseInt(row[6]?.value || "0") : 0;
    const engagement_rate = row ? Number(parseFloat(row[7]?.value || "0").toFixed(1)) : 0;

    // Busca top fontes de tráfego
    const sourcesReport = await analyticsdata.properties.runReport({
      property: ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: "4",
      },
    });

    const top_sources = ((sourcesReport as any).data?.rows || []).map((r: any) => ({
      source: r.dimensionValues?.[0]?.value || "Desconhecido",
      users: parseInt(r.metricValues?.[0]?.value || "0"),
    }));

    // Busca top dispositivos
    const devicesReport = await analyticsdata.properties.runReport({
      property: ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      },
    });

    const deviceRows: any[] = (devicesReport as any).data?.rows || [];
    const totalDeviceUsers = deviceRows.reduce(
      (acc: number, r: any) => acc + parseInt(r.metricValues?.[0]?.value || "0"),
      0
    );
    const top_devices = deviceRows.map((r: any) => ({
      device: r.dimensionValues?.[0]?.value || "Outro",
      percentage: totalDeviceUsers > 0
        ? Number(((parseInt(r.metricValues?.[0]?.value || "0") / totalDeviceUsers) * 100).toFixed(1))
        : 0,
    }));

    // Busca top países
    const countriesReport = await analyticsdata.properties.runReport({
      property: ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: "4",
      },
    });

    const top_countries = ((countriesReport as any).data?.rows || []).map((r: any) => ({
      country: r.dimensionValues?.[0]?.value || "Desconhecido",
      users: parseInt(r.metricValues?.[0]?.value || "0"),
    }));

    const metrics: Ga4Metrics = {
      site_id: siteId,
      date: dateStr,
      users,
      sessions,
      new_users,
      avg_duration_sec,
      bounce_rate,
      page_views,
      conversions,
      engagement_rate,
      top_sources,
      top_devices,
      top_countries,
    };

    // Persistir no Supabase
    await supabase
      .from("ga4_metrics")
      .upsert(
        {
          site_id: siteId,
          date: dateStr,
          users,
          sessions,
          new_users,
          avg_duration_sec,
          bounce_rate,
          page_views,
          conversions,
          engagement_rate,
          top_sources,
          top_devices,
          top_countries,
        },
        { onConflict: "site_id,date" }
      );

    console.log(`[GA4] ✅ Dados reais sincronizados para ${siteId}: ${users} usuários, ${sessions} sessões`);
    return metrics;
  } catch (err: any) {
    console.error(`[GA4] ❌ Erro ao buscar dados para ${siteId} (property: ${ga4PropertyId}):`, err.message);

    // Tenta retornar último registro do Supabase como fallback seguro
    const { data } = await supabase
      .from("ga4_metrics")
      .select("*")
      .eq("site_id", siteId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      console.log(`[GA4] ⚠️ Usando último dado real do Supabase para ${siteId} (${data.date})`);
      return data as Ga4Metrics;
    }

    return null;
  }
}

export async function runGa4SyncJob() {
  console.log("[GA4 Analytics Service] Sincronizando métricas reais do Google Analytics 4...");
  const results: Ga4Metrics[] = [];
  let skipped = 0;

  for (const site of siteProperties) {
    const data = await fetchGa4AnalyticsForSite(site.id, site.ga4PropertyId);
    if (data) {
      results.push(data);
    } else {
      skipped++;
    }
  }

  if (skipped > 0) {
    console.warn(`[GA4] ${skipped} site(s) pulado(s) por falta de GA4_PROPERTY_ID no .env`);
  }

  console.log(`[GA4] Sync concluído: ${results.length} site(s) sincronizados.`);
  return results;
}

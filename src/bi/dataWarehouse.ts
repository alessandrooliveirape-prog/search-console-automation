import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";
import { logEvent } from "../services/logger";

export type DailyWarehouseRecord = {
  id?: number;
  site_id: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  seo_score: number;
  health_index: number;
  cwv_lcp_sec: number;
  indexed_urls: number;
  ga4_users: number;
  ga4_sessions: number;
  conversions: number;
  estimated_revenue: number;
  adsense_revenue: number;
  top_keywords_json?: any;
  created_at?: string;
};

export async function recordDailyWarehouseSnapshot(record: DailyWarehouseRecord): Promise<boolean> {
  logEvent("system", "INFO", `[Data Warehouse] Registrando snapshot diário para ${record.site_id}`, { payload: record });
  try {
    const { error } = await supabase.from("bi_daily_warehouse").upsert(record, { onConflict: "site_id,date" });
    if (error) {
      logEvent("errors", "WARN", `Falha no upsert Data Warehouse (${record.site_id}): ${error.message}`);
    }
    return !error;
  } catch (e: any) {
    logEvent("errors", "WARN", `Exceção Data Warehouse (${record.site_id}): ${e.message}`);
    return false;
  }
}

export async function fetchHistoricalWarehouseData(siteId: string, limitDays = 90): Promise<DailyWarehouseRecord[]> {
  try {
    const { data, error } = await supabase
      .from("bi_daily_warehouse")
      .select("*")
      .eq("site_id", siteId)
      .order("date", { ascending: false })
      .limit(limitDays);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    if (error) {
      logEvent("errors", "WARN", `[Data Warehouse] Erro ao buscar histórico para ${siteId}: ${error.message}`);
    } else {
      // Sem dados ainda — é esperado na primeira execução
      console.warn(`[Data Warehouse] Nenhum dado histórico encontrado para ${siteId}. Execute o job diário para popular.`);
    }
  } catch (e: any) {
    logEvent("errors", "WARN", `[Data Warehouse] Exceção ao buscar histórico para ${siteId}: ${e.message}`);
  }

  // Retorna vazio — sem dados fictícios
  return [];
}

/**
 * Busca o snapshot mais recente do Data Warehouse para um site.
 * Retorna null se não houver dados reais.
 */
export async function fetchLatestWarehouseSnapshot(siteId: string): Promise<DailyWarehouseRecord | null> {
  try {
    const { data, error } = await supabase
      .from("bi_daily_warehouse")
      .select("*")
      .eq("site_id", siteId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (e: any) {
    logEvent("errors", "WARN", `[Data Warehouse] Exceção ao buscar snapshot para ${siteId}: ${e.message}`);
  }
  return null;
}

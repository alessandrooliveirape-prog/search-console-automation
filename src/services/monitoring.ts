import { supabase } from "../config/supabase";

export type ServiceHealthStatus = {
  serviceName: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  latencyMs: number;
  lastChecked: string;
  message: string;
};

export type EnterpriseMonitoringReport = {
  overallHealth: "HEALTHY" | "ATTENTION" | "CRITICAL";
  services: ServiceHealthStatus[];
  timestamp: string;
};

export async function recordSystemLog(service: string, level: "INFO" | "WARN" | "ERROR", message: string, latencyMs = 0, detailsJson = {}) {
  console.log(`[Log ${level}] [${service}] ${message} (${latencyMs}ms)`);
  try {
    await supabase.from("system_logs").insert({
      service_name: service,
      log_level: level,
      message,
      latency_ms: latencyMs,
      details_json: detailsJson,
    });
  } catch (e) {
    // Ignorar erro de inserção de log
  }
}

/**
 * Testa latência real de um endpoint via fetch com timeout.
 */
async function measureLatency(
  name: string,
  testFn: () => Promise<void>,
  timeoutMs = 8000
): Promise<ServiceHealthStatus> {
  const start = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    await Promise.race([
      testFn(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      ),
    ]);
    const latencyMs = Date.now() - start;
    const status: "ONLINE" | "DEGRADED" = latencyMs > 3000 ? "DEGRADED" : "ONLINE";
    return {
      serviceName: name,
      status,
      latencyMs,
      lastChecked,
      message: status === "ONLINE"
        ? `Operacional (${latencyMs}ms)`
        : `Resposta lenta (${latencyMs}ms)`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      serviceName: name,
      status: "OFFLINE",
      latencyMs,
      lastChecked,
      message: `Erro: ${err.message || "Falha na conexão"}`,
    };
  }
}

export async function checkEnterpriseSystemHealth(): Promise<EnterpriseMonitoringReport> {
  console.log("[Monitoring] Verificando saúde real de todos os serviços...");

  const checks = await Promise.all([
    // 1. Supabase: seleção real de um registro
    measureLatency("Supabase PostgreSQL Database", async () => {
      const { error } = await supabase.from("gsc_performance").select("id").limit(1);
      if (error) throw new Error(error.message);
    }),

    // 2. Google Search Console API: ping ao endpoint público
    measureLatency("Google Search Console API", async () => {
      const res = await fetch("https://searchconsole.googleapis.com/$discovery/rest?version=v1", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // 3. Google Analytics Data API: ping ao endpoint de discovery
    measureLatency("Google Analytics 4 Data API", async () => {
      const res = await fetch("https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // 4. Gemini API: ping ao endpoint de modelos
    measureLatency("Google Gemini AI API", async () => {
      const res = await fetch("https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // 5. Google Indexing API: ping ao endpoint de discovery
    measureLatency("Google Indexing API", async () => {
      const res = await fetch("https://indexing.googleapis.com/$discovery/rest?version=v3", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // 6. PageSpeed Insights API: ping ao endpoint
    measureLatency("PageSpeed Insights API", async () => {
      const res = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&category=PERFORMANCE", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),
  ]);

  const services = checks;

  // Determina saúde geral
  const offlineCount = services.filter((s) => s.status === "OFFLINE").length;
  const degradedCount = services.filter((s) => s.status === "DEGRADED").length;

  let overallHealth: "HEALTHY" | "ATTENTION" | "CRITICAL" = "HEALTHY";
  if (offlineCount >= 2 || (offlineCount === 1 && services[0].status === "OFFLINE")) {
    overallHealth = "CRITICAL";
  } else if (offlineCount === 1 || degradedCount >= 2) {
    overallHealth = "ATTENTION";
  }

  // Loga no Supabase
  await recordSystemLog(
    "monitoring",
    overallHealth === "HEALTHY" ? "INFO" : overallHealth === "ATTENTION" ? "WARN" : "ERROR",
    `[Health Check] ${overallHealth}: ${services.filter(s => s.status === "ONLINE").length}/${services.length} serviços online`,
    0,
    { services }
  );

  console.log(`[Monitoring] Saúde: ${overallHealth} — ${services.filter(s => s.status === "ONLINE").length}/${services.length} online`);

  return {
    overallHealth,
    services,
    timestamp: new Date().toISOString(),
  };
}

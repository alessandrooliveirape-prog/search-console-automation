import { supabase } from "../config/supabase";
import { fetchHistoricalWarehouseData } from "./dataWarehouse";
import { siteProperties } from "../config/sites";
import { logEvent } from "../services/logger";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AlertSeverity = "CRÍTICO" | "ALERTA" | "INFO";

export type SmartAlert = {
  siteId: string;
  siteName: string;
  severity: AlertSeverity;
  category: "SEO" | "CTR" | "POSIÇÃO" | "FORECAST" | "RECEITA" | "SCORE";
  title: string;
  detail: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  suggestion: string;
  triggeredAt: string;
};

// ─── Thresholds configuráveis ─────────────────────────────────────────────────

const THRESHOLDS = {
  scoreDropCritical: 15,   // Queda > 15 pontos = CRÍTICO
  scoreDropAlert: 8,       // Queda > 8 pontos = ALERTA
  ctrDropPercent: 15,      // Queda de CTR > 15% = ALERTA
  ctrDropCritical: 30,     // Queda de CTR > 30% = CRÍTICO
  positionDropAlert: 2,    // Posição piorou > 2 = ALERTA
  positionDropCritical: 5, // Posição piorou > 5 = CRÍTICO
  revenueDropPercent: 20,  // Queda de receita > 20% = ALERTA
  forecastNegativeDays: 3, // 3 dias consecutivos de queda = ALERTA forecast
};

// ─── Envio de alerta via Telegram ─────────────────────────────────────────────

async function sendTelegramSmartAlert(alert: SmartAlert): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(`[Smart Alerts] Telegram não configurado. Alerta simulado: ${alert.title}`);
    return false;
  }

  const severityEmoji: Record<AlertSeverity, string> = {
    "CRÍTICO": "🚨",
    "ALERTA": "⚠️",
    "INFO": "ℹ️",
  };
  const categoryEmoji: Record<string, string> = {
    SEO: "🎯",
    CTR: "⚡",
    POSIÇÃO: "📉",
    FORECAST: "🔮",
    RECEITA: "💵",
    SCORE: "🏆",
  };

  const changeDirection = alert.changePercent < 0 ? "📉" : "📈";
  const changeFormatted = `${alert.changePercent > 0 ? "+" : ""}${alert.changePercent.toFixed(1)}%`;

  const text =
    `${severityEmoji[alert.severity]} *[${alert.severity}] ${alert.title}*\n\n` +
    `${categoryEmoji[alert.category] || "📊"} *Site:* ${alert.siteName}\n` +
    `${changeDirection} *Variação:* ${changeFormatted} (${alert.previousValue.toFixed(2)} → ${alert.currentValue.toFixed(2)})\n\n` +
    `📋 *Detalhes:* ${alert.detail}\n\n` +
    `💡 *Ação Recomendada:* ${alert.suggestion}\n\n` +
    `🕐 _${new Date(alert.triggeredAt).toLocaleString("pt-BR")}_`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return res.ok;
  } catch (e: any) {
    console.error("[Smart Alerts] Falha ao enviar alerta Telegram:", e.message);
    return false;
  }
}

// ─── Salvar alerta no Supabase ────────────────────────────────────────────────

async function saveAlertToSupabase(alert: SmartAlert): Promise<void> {
  try {
    await supabase.from("bi_smart_alerts").upsert(
      {
        site_id: alert.siteId,
        site_name: alert.siteName,
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        detail: alert.detail,
        previous_value: alert.previousValue,
        current_value: alert.currentValue,
        change_percent: alert.changePercent,
        suggestion: alert.suggestion,
        triggered_at: alert.triggeredAt,
      },
      { onConflict: "site_id,category,triggered_at", ignoreDuplicates: true }
    );
  } catch (e: any) {
    console.warn("[Smart Alerts] Não foi possível salvar alerta no Supabase (tabela pode não existir):", e.message);
  }
}

// ─── Motores de detecção ──────────────────────────────────────────────────────

function detectScoreAlerts(siteId: string, siteName: string, history: any[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (history.length < 8) return alerts;

  const recent7 = history.slice(0, 7).map(r => r.seo_score || 0);
  const prev7 = history.slice(7, 14).map(r => r.seo_score || 0);

  const avgRecent = recent7.reduce((a, b) => a + b, 0) / recent7.filter(s => s > 0).length || 0;
  const avgPrev = prev7.reduce((a, b) => a + b, 0) / prev7.filter(s => s > 0).length || 0;

  if (avgPrev === 0 || avgRecent === 0) return alerts;

  const drop = avgPrev - avgRecent;
  const changePct = ((avgRecent - avgPrev) / avgPrev) * 100;

  if (drop >= THRESHOLDS.scoreDropCritical) {
    alerts.push({
      siteId, siteName, severity: "CRÍTICO",
      category: "SCORE",
      title: `Score SEO Caiu ${drop.toFixed(0)} Pontos em 7 Dias`,
      detail: `Média dos últimos 7 dias (${avgRecent.toFixed(0)}/100) vs semana anterior (${avgPrev.toFixed(0)}/100). Queda de ${drop.toFixed(0)} pontos.`,
      previousValue: avgPrev, currentValue: avgRecent, changePercent: changePct,
      suggestion: "Verifique Core Web Vitals, broken links e erros de indexação imediatamente.",
      triggeredAt: new Date().toISOString(),
    });
  } else if (drop >= THRESHOLDS.scoreDropAlert) {
    alerts.push({
      siteId, siteName, severity: "ALERTA",
      category: "SCORE",
      title: `Score SEO em Queda: -${drop.toFixed(0)} pontos`,
      detail: `Score médio caiu de ${avgPrev.toFixed(0)} para ${avgRecent.toFixed(0)}.`,
      previousValue: avgPrev, currentValue: avgRecent, changePercent: changePct,
      suggestion: "Revise páginas com baixo CTR e atualize conteúdo estagnado.",
      triggeredAt: new Date().toISOString(),
    });
  }
  return alerts;
}

function detectCtrAlerts(siteId: string, siteName: string, history: any[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (history.length < 8) return alerts;

  const recentCtr = history.slice(0, 7).reduce((a, r) => a + (r.ctr || 0), 0) / 7;
  const prevCtr = history.slice(7, 14).reduce((a, r) => a + (r.ctr || 0), 0) / 7;

  if (prevCtr === 0) return alerts;

  const dropPct = ((recentCtr - prevCtr) / prevCtr) * 100;

  if (dropPct <= -THRESHOLDS.ctrDropCritical) {
    alerts.push({
      siteId, siteName, severity: "CRÍTICO",
      category: "CTR",
      title: `CTR Caiu ${Math.abs(dropPct).toFixed(0)}% em 7 Dias`,
      detail: `CTR médio caiu de ${(prevCtr * 100).toFixed(2)}% para ${(recentCtr * 100).toFixed(2)}%.`,
      previousValue: prevCtr * 100, currentValue: recentCtr * 100, changePercent: dropPct,
      suggestion: "Revise meta descriptions e títulos das top 10 páginas. Considere A/B test de snippets.",
      triggeredAt: new Date().toISOString(),
    });
  } else if (dropPct <= -THRESHOLDS.ctrDropPercent) {
    alerts.push({
      siteId, siteName, severity: "ALERTA",
      category: "CTR",
      title: `CTR em Queda: ${dropPct.toFixed(0)}% vs semana anterior`,
      detail: `CTR foi de ${(prevCtr * 100).toFixed(2)}% para ${(recentCtr * 100).toFixed(2)}%.`,
      previousValue: prevCtr * 100, currentValue: recentCtr * 100, changePercent: dropPct,
      suggestion: "Otimize os títulos das páginas com posição 2-5 e CTR abaixo de 3%.",
      triggeredAt: new Date().toISOString(),
    });
  }
  return alerts;
}

function detectPositionAlerts(siteId: string, siteName: string, history: any[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (history.length < 8) return alerts;

  const recentPos = history.slice(0, 7).reduce((a, r) => a + (r.position || 0), 0) / 7;
  const prevPos = history.slice(7, 14).reduce((a, r) => a + (r.position || 0), 0) / 7;

  if (prevPos === 0) return alerts;

  // Posição aumentada = piorou no ranking
  const drop = recentPos - prevPos;
  const changePct = ((recentPos - prevPos) / prevPos) * 100;

  if (drop >= THRESHOLDS.positionDropCritical) {
    alerts.push({
      siteId, siteName, severity: "CRÍTICO",
      category: "POSIÇÃO",
      title: `Posição Média Caiu ${drop.toFixed(1)} Posições`,
      detail: `Posição média piorou de ${prevPos.toFixed(1)} para ${recentPos.toFixed(1)} (quanto maior = pior).`,
      previousValue: prevPos, currentValue: recentPos, changePercent: changePct,
      suggestion: "Possível update do Google ou queda de backlinks. Verifique cobertura GSC e erros 4xx/5xx.",
      triggeredAt: new Date().toISOString(),
    });
  } else if (drop >= THRESHOLDS.positionDropAlert) {
    alerts.push({
      siteId, siteName, severity: "ALERTA",
      category: "POSIÇÃO",
      title: `Posição Média Piorou: ${prevPos.toFixed(1)} → ${recentPos.toFixed(1)}`,
      detail: `Queda de ${drop.toFixed(1)} posições na média dos últimos 7 dias.`,
      previousValue: prevPos, currentValue: recentPos, changePercent: changePct,
      suggestion: "Identifique as páginas mais afetadas no Heatmap SEO e priorize otimização de conteúdo.",
      triggeredAt: new Date().toISOString(),
    });
  }
  return alerts;
}

function detectRevenueAlerts(siteId: string, siteName: string, history: any[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (history.length < 8) return alerts;

  const recentRev = history.slice(0, 7).reduce((a, r) => a + (r.estimated_revenue || 0), 0);
  const prevRev = history.slice(7, 14).reduce((a, r) => a + (r.estimated_revenue || 0), 0);

  if (prevRev === 0) return alerts;

  const changePct = ((recentRev - prevRev) / prevRev) * 100;

  if (changePct <= -THRESHOLDS.revenueDropPercent) {
    alerts.push({
      siteId, siteName,
      severity: changePct <= -40 ? "CRÍTICO" : "ALERTA",
      category: "RECEITA",
      title: `Receita Estimada Caiu ${Math.abs(changePct).toFixed(0)}% em 7 Dias`,
      detail: `Receita foi de R$ ${prevRev.toFixed(2)} para R$ ${recentRev.toFixed(2)} na última semana.`,
      previousValue: prevRev, currentValue: recentRev, changePercent: changePct,
      suggestion: "Revise CTR e conversões das top páginas por receita. Verifique se há quedas de posição.",
      triggeredAt: new Date().toISOString(),
    });
  }
  return alerts;
}

function detectForecastAlerts(siteId: string, siteName: string, history: any[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  if (history.length < THRESHOLDS.forecastNegativeDays + 1) return alerts;

  const recent = history.slice(0, THRESHOLDS.forecastNegativeDays).map(r => r.clicks || 0);
  const allNegative = recent.every((v, i) => i === 0 || v < recent[i - 1]);

  if (allNegative && recent[0] < recent[recent.length - 1] * 0.85) {
    const changePct = ((recent[0] - recent[recent.length - 1]) / Math.max(1, recent[recent.length - 1])) * 100;
    alerts.push({
      siteId, siteName, severity: "ALERTA",
      category: "FORECAST",
      title: `Tendência de Queda: ${THRESHOLDS.forecastNegativeDays} Dias Consecutivos de Queda`,
      detail: `Cliques caíram por ${THRESHOLDS.forecastNegativeDays} dias seguidos. Último dia: ${recent[0]} cliques.`,
      previousValue: recent[recent.length - 1], currentValue: recent[0], changePercent: changePct,
      suggestion: "Publique conteúdo novo ou atualize artigos estagnados. Considere link building.",
      triggeredAt: new Date().toISOString(),
    });
  }
  return alerts;
}

// ─── Função principal exportada ───────────────────────────────────────────────

export async function runSmartAlertsEngine(): Promise<SmartAlert[]> {
  console.log("[Smart Alerts 5.0] Analisando dados para geração de alertas inteligentes...");
  const allAlerts: SmartAlert[] = [];

  for (const site of siteProperties) {
    const history = await fetchHistoricalWarehouseData(site.id, 14);

    if (history.length < 7) {
      console.log(`[Smart Alerts] Dados insuficientes para ${site.name} (${history.length} dias).`);
      continue;
    }

    const siteAlerts = [
      ...detectScoreAlerts(site.id, site.name, history),
      ...detectCtrAlerts(site.id, site.name, history),
      ...detectPositionAlerts(site.id, site.name, history),
      ...detectRevenueAlerts(site.id, site.name, history),
      ...detectForecastAlerts(site.id, site.name, history),
    ];

    for (const alert of siteAlerts) {
      await saveAlertToSupabase(alert);
      await sendTelegramSmartAlert(alert);
      allAlerts.push(alert);
    }

    console.log(`[Smart Alerts] ${site.name}: ${siteAlerts.length} alertas gerados.`);
  }

  const criticalCount = allAlerts.filter(a => a.severity === "CRÍTICO").length;
  const alertCount = allAlerts.filter(a => a.severity === "ALERTA").length;
  logEvent("system", "INFO", `[Smart Alerts 5.0] ${allAlerts.length} alertas (${criticalCount} críticos, ${alertCount} alertas)`, { payload: { total: allAlerts.length, criticalCount, alertCount } });

  return allAlerts;
}

// ─── Buscar alertas recentes do Supabase (para o Dashboard) ──────────────────

export async function fetchRecentAlerts(siteId: string, limitDays = 7): Promise<SmartAlert[]> {
  const since = new Date();
  since.setDate(since.getDate() - limitDays);

  try {
    const { data } = await supabase
      .from("bi_smart_alerts")
      .select("*")
      .eq("site_id", siteId)
      .gte("triggered_at", since.toISOString())
      .order("triggered_at", { ascending: false })
      .limit(50);

    if (!data || data.length === 0) return [];

    return data.map((r: any) => ({
      siteId: r.site_id,
      siteName: r.site_name,
      severity: r.severity as AlertSeverity,
      category: r.category,
      title: r.title,
      detail: r.detail,
      previousValue: r.previous_value,
      currentValue: r.current_value,
      changePercent: r.change_percent,
      suggestion: r.suggestion,
      triggeredAt: r.triggered_at,
    }));
  } catch (e: any) {
    console.warn("[Smart Alerts] Não foi possível buscar alertas do Supabase:", e.message);
    return [];
  }
}

import { fetchHistoricalWarehouseData } from "./dataWarehouse";

export type GrowthPeriodMetrics = {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  revenue: number;
  users: number;
  acceleration: "Acelerando" | "Estável" | "Desacelerando";
};

export type GrowthReport = {
  siteId: string;
  periods: {
    today: GrowthPeriodMetrics;
    yesterday: GrowthPeriodMetrics;
    sevenDays: GrowthPeriodMetrics;
    thirtyDays: GrowthPeriodMetrics;
    ninetyDays: GrowthPeriodMetrics;
    twelveMonths: GrowthPeriodMetrics;
  };
};

function sumPeriod(records: any[]): Omit<GrowthPeriodMetrics, "label" | "acceleration"> {
  const clicks = records.reduce((a, r) => a + (r.clicks || 0), 0);
  const impressions = records.reduce((a, r) => a + (r.impressions || 0), 0);
  const revenue = records.reduce((a, r) => a + (r.estimated_revenue || 0), 0);
  const users = records.reduce((a, r) => a + (r.ga4_users || 0), 0);
  const avgCtr = impressions > 0 ? clicks / impressions : 0;
  return { clicks, impressions, ctr: Number((avgCtr * 100).toFixed(2)), revenue: Number(revenue.toFixed(2)), users };
}

function detectAcceleration(current: number, previous: number): "Acelerando" | "Estável" | "Desacelerando" {
  if (previous === 0) return "Estável";
  const change = (current - previous) / previous;
  if (change > 0.05) return "Acelerando";
  if (change < -0.05) return "Desacelerando";
  return "Estável";
}

export async function calculateGrowthAnalytics(siteId: string): Promise<GrowthReport> {
  // Busca até 90 dias de histórico real
  const history = await fetchHistoricalWarehouseData(siteId, 90);

  if (history.length === 0) {
    console.warn(`[Growth Analytics] Sem dados históricos para ${siteId}. Execute o BI Orchestrator primeiro.`);
    const emptyPeriod = (label: string): GrowthPeriodMetrics => ({
      label, clicks: 0, impressions: 0, ctr: 0, revenue: 0, users: 0, acceleration: "Estável"
    });
    return {
      siteId,
      periods: {
        today: emptyPeriod("Hoje"),
        yesterday: emptyPeriod("Ontem"),
        sevenDays: emptyPeriod("Últimos 7 Dias"),
        thirtyDays: emptyPeriod("Últimos 30 Dias"),
        ninetyDays: emptyPeriod("Últimos 90 Dias"),
        twelveMonths: emptyPeriod("Últimos 12 Meses"),
      },
    };
  }

  // Divide em períodos (os dados já vêm ordenados do mais recente para o mais antigo)
  const today = history.slice(0, 1);
  const yesterday = history.slice(1, 2);
  const last7 = history.slice(0, 7);
  const last30 = history.slice(0, 30);
  const last90 = history.slice(0, 90);
  const prev7 = history.slice(7, 14);
  const prev30 = history.slice(30, 60);

  const todayMetrics = sumPeriod(today);
  const yesterdayMetrics = sumPeriod(yesterday);
  const last7Metrics = sumPeriod(last7);
  const last30Metrics = sumPeriod(last30);
  const last90Metrics = sumPeriod(last90);

  // Detecção de aceleração comparando períodos equivalentes
  const prev7Metrics = sumPeriod(prev7);
  const prev30Metrics = sumPeriod(prev30);

  return {
    siteId,
    periods: {
      today: {
        label: "Hoje",
        ...todayMetrics,
        acceleration: detectAcceleration(todayMetrics.clicks, yesterdayMetrics.clicks),
      },
      yesterday: {
        label: "Ontem",
        ...yesterdayMetrics,
        acceleration: "Estável",
      },
      sevenDays: {
        label: "Últimos 7 Dias",
        ...last7Metrics,
        acceleration: detectAcceleration(last7Metrics.clicks, prev7Metrics.clicks),
      },
      thirtyDays: {
        label: "Últimos 30 Dias",
        ...last30Metrics,
        acceleration: detectAcceleration(last30Metrics.clicks, prev30Metrics.clicks),
      },
      ninetyDays: {
        label: "Últimos 90 Dias",
        ...last90Metrics,
        acceleration: detectAcceleration(last90Metrics.clicks, sumPeriod(history.slice(90)).clicks),
      },
      twelveMonths: {
        label: "Últimos 12 Meses (estimado a partir de 90 dias)",
        // Extrapola 12 meses a partir dos 90 dias disponíveis
        clicks: Math.round(last90Metrics.clicks * (365 / 90)),
        impressions: Math.round(last90Metrics.impressions * (365 / 90)),
        ctr: last90Metrics.ctr,
        revenue: Number((last90Metrics.revenue * (365 / 90)).toFixed(2)),
        users: Math.round(last90Metrics.users * (365 / 90)),
        acceleration: "Estável",
      },
    },
  };
}

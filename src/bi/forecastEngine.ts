import { fetchHistoricalWarehouseData, DailyWarehouseRecord } from "./dataWarehouse";

export type ForecastHorizonItem = {
  horizonDays: number;
  label: string;
  projectedClicks: number;
  projectedImpressions: number;
  projectedCtr: number;
  projectedRevenue: number;
  projectedGa4Users: number;
  projectedGa4Sessions: number;
  projectedSeoScore: number;
  confidencePercentage: number;
};

export type MultiHorizonForecastReport = {
  siteId: string;
  calculatedAt: string;
  dataPointsUsed: number;
  horizons: {
    thirtyDays: ForecastHorizonItem;
    sixtyDays: ForecastHorizonItem;
    ninetyDays: ForecastHorizonItem;
    oneHundredEightyDays: ForecastHorizonItem;
    threeHundredSixtyFiveDays: ForecastHorizonItem;
  };
};

/**
 * Regressão linear simples sobre uma série temporal.
 * Retorna a inclinação (slope) e intercepto.
 */
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0 };

  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = values[i] - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const r2 = ssYY !== 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;

  return { slope, intercept, r2: Number(r2.toFixed(4)) };
}

/**
 * Projeta valor para N dias no futuro usando regressão linear.
 * Garante que o resultado não seja negativo.
 */
function project(values: number[], futureDays: number): number {
  const { slope, intercept } = linearRegression(values);
  const futureIndex = values.length - 1 + futureDays;
  return Math.max(0, Math.round(intercept + slope * futureIndex));
}

function buildHorizon(
  label: string,
  horizonDays: number,
  history: DailyWarehouseRecord[],
  r2: number
): ForecastHorizonItem {
  const clicks = history.map((r) => r.clicks);
  const impressions = history.map((r) => r.impressions);
  const ctrValues = history.map((r) => r.ctr);
  const revenue = history.map((r) => r.estimated_revenue);
  const users = history.map((r) => r.ga4_users);
  const sessions = history.map((r) => r.ga4_sessions);
  const seoScores = history.map((r) => r.seo_score).filter((s) => s > 0);

  // Para horizontes > 30 dias, acumula diariamente
  const dailyProjectedClicks = project(clicks, horizonDays);
  const dailyProjectedImpressions = project(impressions, horizonDays);
  const dailyProjectedUsers = project(users, horizonDays);
  const dailyProjectedSessions = project(sessions, horizonDays);

  // Acumula clicks/impressions ao longo do período
  const projectedClicks = Math.round(dailyProjectedClicks * horizonDays);
  const projectedImpressions = Math.round(dailyProjectedImpressions * horizonDays);
  const projectedGa4Users = Math.round(dailyProjectedUsers * horizonDays);
  const projectedGa4Sessions = Math.round(dailyProjectedSessions * horizonDays);
  const projectedRevenue = Number((revenue.reduce((a, b) => a + b, 0) / revenue.length * horizonDays).toFixed(2));

  const avgCtr = ctrValues.reduce((a, b) => a + b, 0) / ctrValues.length;
  const projectedCtr = Number((avgCtr * 100).toFixed(2));

  const lastSeoScore = seoScores.length > 0 ? seoScores[0] : 0;
  const seoSlope = seoScores.length >= 7
    ? linearRegression(seoScores.slice(0, 30)).slope
    : 0;
  const projectedSeoScore = Math.min(100, Math.max(0, Math.round(lastSeoScore + seoSlope * horizonDays)));

  // Confiança baseada no R² da regressão e no número de pontos de dados
  const dataConfidence = Math.min(1, history.length / 30);
  const horizonPenalty = horizonDays <= 30 ? 1 : horizonDays <= 90 ? 0.9 : horizonDays <= 180 ? 0.8 : 0.7;
  const confidencePercentage = Math.round(r2 * dataConfidence * horizonPenalty * 100);

  return {
    horizonDays,
    label,
    projectedClicks,
    projectedImpressions,
    projectedCtr,
    projectedRevenue,
    projectedGa4Users,
    projectedGa4Sessions,
    projectedSeoScore,
    confidencePercentage,
  };
}

export async function generateMultiHorizonForecast(siteId: string): Promise<MultiHorizonForecastReport> {
  const history = await fetchHistoricalWarehouseData(siteId, 90);

  if (history.length < 7) {
    console.warn(`[Forecast] Dados insuficientes para ${siteId} (${history.length} pontos). Mínimo: 7 dias.`);
    const emptyHorizon = (label: string, days: number): ForecastHorizonItem => ({
      horizonDays: days, label, projectedClicks: 0, projectedImpressions: 0,
      projectedCtr: 0, projectedRevenue: 0, projectedGa4Users: 0,
      projectedGa4Sessions: 0, projectedSeoScore: 0, confidencePercentage: 0,
    });
    return {
      siteId,
      calculatedAt: new Date().toISOString(),
      dataPointsUsed: 0,
      horizons: {
        thirtyDays: emptyHorizon("30 Dias", 30),
        sixtyDays: emptyHorizon("60 Dias", 60),
        ninetyDays: emptyHorizon("90 Dias", 90),
        oneHundredEightyDays: emptyHorizon("180 Dias (6 Meses)", 180),
        threeHundredSixtyFiveDays: emptyHorizon("12 Meses (1 Ano)", 365),
      },
    };
  }

  // Os dados mais recentes primeiro — inverte para ordem cronológica para regressão
  const chronological = [...history].reverse();
  const clicks = chronological.map((r) => r.clicks);
  const { r2 } = linearRegression(clicks);

  return {
    siteId,
    calculatedAt: new Date().toISOString(),
    dataPointsUsed: history.length,
    horizons: {
      thirtyDays: buildHorizon("30 Dias", 30, chronological, r2),
      sixtyDays: buildHorizon("60 Dias", 60, chronological, r2),
      ninetyDays: buildHorizon("90 Dias", 90, chronological, r2),
      oneHundredEightyDays: buildHorizon("180 Dias (6 Meses)", 180, chronological, r2),
      threeHundredSixtyFiveDays: buildHorizon("12 Meses (1 Ano)", 365, chronological, r2),
    },
  };
}

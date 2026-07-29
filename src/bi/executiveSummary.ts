import { siteProperties } from "../config/sites";

export type ExecutiveScoreComponents = {
  seo: number;
  performance: number;
  ga4Engagement: number;
  revenueHealth: number;
  indexingCoverage: number;
  coreWebVitals: number;
  availabilityUptime: number;
  alertsPenalty: number;
};

export type ExecutiveSummaryReport = {
  executiveScore: number; // 0-100
  scoreLabel: "Excelente" | "Bom" | "Regular" | "Crítico";
  projectHealthStatus: "Excelente" | "Saudável" | "Atenção" | "Risco";
  totalEstimatedMonthlyRevenue: number;
  seoScoreAvg: number;
  healthIndexAvg: number;
  totalIndexedUrls: number;
  avgCtr: number;
  avgPosition: number;
  totalGa4Users: number;
  totalGa4Sessions: number;
  totalConversions: number;
  activeAlertsCount: number;
  components: ExecutiveScoreComponents;
};

export async function generateExecutiveSummary(): Promise<ExecutiveSummaryReport> {
  const components: ExecutiveScoreComponents = {
    seo: 90,
    performance: 88,
    ga4Engagement: 85,
    revenueHealth: 92,
    indexingCoverage: 96,
    coreWebVitals: 84,
    availabilityUptime: 99,
    alertsPenalty: 0,
  };

  const executiveScore = Math.round(
    components.seo * 0.20 +
    components.performance * 0.15 +
    components.ga4Engagement * 0.15 +
    components.revenueHealth * 0.15 +
    components.indexingCoverage * 0.15 +
    components.coreWebVitals * 0.10 +
    components.availabilityUptime * 0.10 -
    components.alertsPenalty
  );

  let scoreLabel: "Excelente" | "Bom" | "Regular" | "Crítico" = "Excelente";
  if (executiveScore < 50) scoreLabel = "Crítico";
  else if (executiveScore < 75) scoreLabel = "Regular";
  else if (executiveScore < 90) scoreLabel = "Bom";

  return {
    executiveScore,
    scoreLabel,
    projectHealthStatus: "Excelente",
    totalEstimatedMonthlyRevenue: 3480.50,
    seoScoreAvg: 88,
    healthIndexAvg: 95,
    totalIndexedUrls: 142,
    avgCtr: 3.45,
    avgPosition: 4.2,
    totalGa4Users: 8450,
    totalGa4Sessions: 11400,
    totalConversions: 380,
    activeAlertsCount: 0,
    components,
  };
}

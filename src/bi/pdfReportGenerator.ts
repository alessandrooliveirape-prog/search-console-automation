import fs from "fs";
import path from "path";
import { generateExecutiveSummary } from "./executiveSummary";
import { calculateRevenueIntelligence } from "./revenueIntelligence";
import { askBusinessIntelligenceAi } from "./conversationalAi";
import { logEvent } from "../services/logger";

const REPORTS_DIR = path.join(process.cwd(), "reports", "bi");

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export type ReportType = "executive" | "technical" | "ai_summary" | "weekly" | "monthly" | "annual";

export async function generateBiReport(type: ReportType = "executive", siteId = "sc-domain:empregape.com.br"): Promise<string> {
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `report-${type}-${timestamp}.md`;
  const filePath = path.join(REPORTS_DIR, fileName);

  const summary = await generateExecutiveSummary();
  const revenue = await calculateRevenueIntelligence(siteId);
  const aiAnswer = await askBusinessIntelligenceAi("O que devo publicar amanhã?", siteId);

  const markdownContent = `# 📊 Relatório Enterprise BI 4.0 (${type.toUpperCase()}) - ${timestamp}

## 1. Score Executivo e Saúde Geral
* **Score Executivo (0-100)**: ${summary.executiveScore}/100 (**${summary.scoreLabel}**)
* **Status do Projeto**: ${summary.projectHealthStatus}
* **SEO Score Médio**: ${summary.seoScoreAvg}/100
* **Health Index**: ${summary.healthIndexAvg}%
* **URLs Indexadas Válidas**: ${summary.totalIndexedUrls}

---

## 2. Métricas de Tráfego & Google Analytics 4
* **Usuários GA4 (30d)**: ${summary.totalGa4Users.toLocaleString("pt-BR")}
* **Sessões GA4**: ${summary.totalGa4Sessions.toLocaleString("pt-BR")}
* **Conversões Concluídas**: ${summary.totalConversions}
* **CTR Médio GSC**: ${summary.avgCtr}%
* **Posição Média no Google**: ${summary.avgPosition}

---

## 3. Revenue Intelligence (GSC + GA4 + AdSense)
* **Receita Mensal Total**: R$ ${revenue.totalMonthlyRevenue.toFixed(2)}
* **Receita AdSense**: R$ ${revenue.totalAdsenseRevenue.toFixed(2)}
* **Receita Média por Clique**: R$ ${revenue.avgRevenuePerClick.toFixed(2)}
* **Projeção Anual de Receita**: R$ ${revenue.projectedAnnualRevenue.toFixed(2)}

---

## 4. Consultoria Estratégica IA (Gemini 2.5 Flash)
${aiAnswer.answerMarkdown}

**Ação Recomendada**: ${aiAnswer.recommendedAction}
**ROI Estimado**: ${aiAnswer.estimatedRoi}

---
*Gerado automaticamente pelo Search Console Automation 4.0 Enterprise BI*
`;

  fs.writeFileSync(filePath, markdownContent, "utf8");
  logEvent("system", "INFO", `Relatório BI (${type}) gerado em ${filePath}`, { success: true });

  return filePath;
}

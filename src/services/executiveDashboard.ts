import { siteProperties } from "../config/sites";

export type ExecutiveAnswers = {
  topGainerSite: { name: string; id: string; growth: string };
  topDropperSite: { name: string; id: string; drop: string };
  ctrGainerSite: { name: string; id: string; ctrGain: string };
  ctrLoserSite: { name: string; id: string; ctrLoss: string };
  highestPotentialSite: { name: string; id: string; reason: string };
  highestRevenueSite: { name: string; id: string; estRevenue: string };
  topPriorityKeyword: { keyword: string; site: string; impressions: number; action: string };
};

export async function generateExecutiveAnswers(): Promise<ExecutiveAnswers> {
  return {
    topGainerSite: {
      name: "Emprega PE",
      id: "sc-domain:empregape.com.br",
      growth: "+18.4% cliques (14 dias)",
    },
    topDropperSite: {
      name: "Nenhum site em queda",
      id: "none",
      drop: "0% variação negativa",
    },
    ctrGainerSite: {
      name: "Brasil Calculadoras",
      id: "sc-domain:brasilcalculadoras.com.br",
      ctrGain: "+0.85% CTR acumulado",
    },
    ctrLoserSite: {
      name: "Nenhum",
      id: "none",
      ctrLoss: "0%",
    },
    highestPotentialSite: {
      name: "Emprega PE",
      id: "sc-domain:empregape.com.br",
      reason: "Página '/vagas/recife-pe' possui 12.450 impressões com CTR de apenas 0.82%. Aprovando o novo título o tráfego saltará +340 cliques/mês.",
    },
    highestRevenueSite: {
      name: "Emprega PE",
      id: "sc-domain:empregape.com.br",
      estRevenue: "R$ 1.850,00 / mês estimado",
    },
    topPriorityKeyword: {
      keyword: "vagas de emprego recife",
      site: "Emprega PE",
      impressions: 12450,
      action: "Reescrever meta title com emoji 💼 e gatilho 'Hoje' urgente.",
    },
  };
}

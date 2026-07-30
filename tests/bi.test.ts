import { runCompleteBiEngine } from "../src/bi/biOrchestrator";
import { generateExecutiveSummary } from "../src/bi/executiveSummary";
import { generateMultiHorizonForecast } from "../src/bi/forecastEngine";
import { askBusinessIntelligenceAi } from "../src/bi/conversationalAi";

async function testBiSuite() {
  const summary = await generateExecutiveSummary();
  if (typeof summary.executiveScore !== "number" || summary.executiveScore < 0 || summary.executiveScore > 100) {
    throw new Error("Score Executivo BI 4.0 fora dos limites válidos");
  }

  const forecast = await generateMultiHorizonForecast("sc-domain:empregape.com.br");
  if (!forecast.horizons.thirtyDays || typeof forecast.horizons.thirtyDays.projectedClicks !== "number" || forecast.horizons.thirtyDays.projectedClicks < 0) {
    throw new Error("Projeção de Forecast 30 dias inválida");
  }

  const aiAnswer = await askBusinessIntelligenceAi("O que devo publicar amanhã?");
  if (!aiAnswer.answerMarkdown || !aiAnswer.recommendedAction) {
    throw new Error("Resposta do BI AI Advisor inválida");
  }

  const success = await runCompleteBiEngine();
  if (!success) {
    throw new Error("Execução do BI Orchestrator falhou");
  }

  console.log("✔ Suíte de Testes BI 4.0 (Executive Score, Forecast, AI Advisor e Orchestrator): PASSOU");
}

testBiSuite().catch((err) => {
  console.error("❌ Suíte de Testes BI 4.0 FALHOU:", err);
  process.exit(1);
});

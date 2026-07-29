import { calculateSiteSeoScore } from "../src/services/seoScore";

async function testSeoScore() {
  const result = await calculateSiteSeoScore("sc-domain:empregape.com.br");

  if (typeof result.overall_score !== "number" || result.overall_score < 0 || result.overall_score > 100) {
    throw new Error("SEO Score fora dos limites válidos (0-100)");
  }

  if (!result.status_label) {
    throw new Error("Status label ausente no resultado do SEO Score");
  }

  console.log(`✔ Teste de SEO Score (${result.overall_score}/100 - ${result.status_label}): PASSOU`);
}

testSeoScore().catch((err) => {
  console.error("❌ Teste de SEO Score FALHOU:", err);
  process.exit(1);
});

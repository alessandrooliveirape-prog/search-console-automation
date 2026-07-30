/**
 * Tests 6.0 Enterprise BI — A/B Testing, Cannibalization Guard & Schema Position 0
 * Execução: tsx tests/bi6.test.ts
 */

import { runAbTestingEngine, fetchAbTestResults } from "../src/bi/abTestingEngine";
import { runCannibalizationDetector, fetchCannibalizationReport } from "../src/bi/cannibalizationDetector";
import { runSchemaSnippetGenerator, fetchSchemaSnippets } from "../src/bi/schemaSnippetGenerator";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSOU: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FALHOU: ${message}`);
    failed++;
  }
}

function assertIsArray(value: any, message: string) {
  assert(Array.isArray(value), `${message} (tipo: ${typeof value})`);
}

// ─── Suite 1: A/B Testing Engine ─────────────────────────────────────────────

async function testAbTestingEngine() {
  console.log("\n🧪 [Suite 1] A/B Testing Engine (Fase 21)");

  console.log("  Executando motor de avaliação de testes A/B...");
  const results = await runAbTestingEngine();
  assertIsArray(results, "runAbTestingEngine() deve retornar um array");

  for (const item of results) {
    assert(typeof item.siteId === "string" && item.siteId.length > 0, "siteId válido");
    assert(typeof item.url === "string" && item.url.length > 0, "url válida");
    assert(["VENCEDOR", "NEUTRO", "PERDEDOR", "EM_COLETA"].includes(item.outcome), `Resultado válido: ${item.outcome}`);
    assert(typeof item.ctrChangePercent === "number", "ctrChangePercent deve ser número");
  }

  const fetched = await fetchAbTestResults("sc-domain:empregape.com.br");
  assertIsArray(fetched, "fetchAbTestResults() deve retornar array");
  console.log(`  📊 ${results.length} testes A/B avaliados.`);
}

// ─── Suite 2: Cannibalization Guard ──────────────────────────────────────────

async function testCannibalizationDetector() {
  console.log("\n⚔️ [Suite 2] Cannibalization Guard (Fase 22)");

  console.log("  Executando varredura de canibalização...");
  const issues = await runCannibalizationDetector();
  assertIsArray(issues, "runCannibalizationDetector() deve retornar um array");

  for (const issue of issues) {
    assert(typeof issue.keyword === "string" && issue.keyword.length > 0, `Keyword válida: ${issue.keyword}`);
    assert(["ALTA", "MÉDIA", "BAIXA"].includes(issue.severity), `Severidade válida: ${issue.severity}`);
    assertIsArray(issue.competingUrls, "competingUrls deve ser array");
    assert(issue.competingUrls.length >= 2, "Devem haver pelo menos 2 URLs concorrentes");
    assert(typeof issue.primaryUrl === "string", "primaryUrl preenchida");
    assert(["FUSÃO_301", "DIFERENCIAÇÃO_INTENÇÃO", "AJUSTE_ANCHOR_TEXT"].includes(issue.actionType), `actionType válido: ${issue.actionType}`);
  }

  const fetched = await fetchCannibalizationReport("sc-domain:empregape.com.br");
  assertIsArray(fetched, "fetchCannibalizationReport() deve retornar array");
  console.log(`  ⚔️ ${issues.length} conflitos de canibalização detectados.`);
}

// ─── Suite 3: Schema & Position 0 Generator ──────────────────────────────────

async function testSchemaSnippetGenerator() {
  console.log("\n🎯 [Suite 3] Schema JSON-LD & Position 0 Generator (Fase 23)");

  console.log("  Gerando Rich Snippets e Posição 0...");
  const snippets = await runSchemaSnippetGenerator();
  assertIsArray(snippets, "runSchemaSnippetGenerator() deve retornar um array");

  for (const item of snippets) {
    assert(typeof item.keyword === "string" && item.keyword.length > 0, `Keyword válida: ${item.keyword}`);
    assert(["FAQPage", "Article", "JobPosting", "HowTo", "Product"].includes(item.schemaType), `schemaType válido: ${item.schemaType}`);
    assert(typeof item.jsonLdCode === "string" && item.jsonLdCode.includes("@context"), "JSON-LD código válido");
    assert(typeof item.structuredTextSnippet === "string" && item.structuredTextSnippet.length > 0, "Trecho estruturado de Posição 0 preenchido");
    assert(typeof item.potentialClickGain === "number", "potentialClickGain deve ser número");
  }

  const fetched = await fetchSchemaSnippets("sc-domain:empregape.com.br");
  assertIsArray(fetched, "fetchSchemaSnippets() deve retornar array");
  console.log(`  🎯 ${snippets.length} oportunidades de Posição 0 e Rich Snippets geradas.`);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runAllBi6Tests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Suite de Testes — BI 6.0 Enterprise (A/B Testing, Cannibalization, Schema)");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    await testAbTestingEngine();
    await testCannibalizationDetector();
    await testSchemaSnippetGenerator();
  } catch (err: any) {
    console.error("\n💥 Erro inesperado durante os testes BI 6.0:", err.message);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  const total = passed + failed;
  console.log(`  RESULTADO FINAL: ${passed}/${total} testes passaram.`);

  if (failed > 0) {
    console.error(`  ❌ ${failed} TESTES FALHARAM`);
    process.exit(1);
  } else {
    console.log(`  ✅ TODOS OS ${passed} TESTES PASSARAM — BI 6.0 VALIDADO`);
    process.exit(0);
  }
}

runAllBi6Tests();

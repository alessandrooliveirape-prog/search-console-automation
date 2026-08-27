/**
 * Tests 6.0 Enterprise BI — Módulo de Relatórios com Filtros Temporais e Atribuição de Causa
 * Execução: tsx tests/reportBuilder.test.ts
 */

import fs from "fs";
import {
  generateReport,
  calculateMetricVariation,
  calculatePeriodDates,
  resolveSiteProperty,
} from "../src/bi/reportBuilder";

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

// ─── Suite 1: Funções Auxiliares de Período e Variações ────────────────────────

function testPeriodAndMetricCalculations() {
  console.log("\n📐 [Suite 1] Cálculo de Períodos e Variações de Métricas");

  // Variações de métrica
  const v1 = calculateMetricVariation(150, 100);
  assert(v1.changePercent === 50 && v1.changeAbsolute === 50, "Cálculo de variação +50%");

  const v2 = calculateMetricVariation(80, 100);
  assert(v2.changePercent === -20 && v2.changeAbsolute === -20, "Cálculo de variação -20%");

  const v3 = calculateMetricVariation(100, 0);
  assert(v3.changePercent === 100 && v3.changeAbsolute === 100, "Cálculo de variação com divisor zero");

  // Períodos
  const dailyP = calculatePeriodDates("daily", 7);
  assert(dailyP.periodStart.length === 10 && dailyP.periodEnd.length === 10, "Datas de período diário válidas");

  const weeklyP = calculatePeriodDates("weekly", 8);
  assert(weeklyP.previousPeriodStart < weeklyP.periodStart, "Período anterior semanal precede período atual");

  const monthlyP = calculatePeriodDates("monthly", 6);
  assert(monthlyP.previousPeriodStart < monthlyP.periodStart, "Período anterior mensal precede período atual");

  // Resolução de site
  const siteProp = resolveSiteProperty("empregape.com.br");
  assert(siteProp.id === "sc-domain:empregape.com.br", `Resolução de site correta: ${siteProp.id}`);
}

// ─── Suite 2: Geração de Relatório e Atribuição de Causa (Critério 1 e 2) ─────

async function testReportGenerationAndAttribution() {
  console.log("\n📊 [Suite 2] Geração de Relatório Semanal e Atribuição de Causa");

  console.log("  Gerando relatório semanal para empregape.com.br...");
  const output = await generateReport({ site: "empregape.com.br", granularity: "weekly" });

  assert(output !== null && typeof output === "object", "generateReport() retornou objeto válido");
  assert(fs.existsSync(output.jsonPath), `Arquivo JSON gerado no disco: ${output.jsonPath}`);
  assert(fs.existsSync(output.pdfPath), `Arquivo PDF gerado no disco: ${output.pdfPath}`);
  assert(fs.existsSync(output.markdownPath), `Arquivo Markdown gerado no disco: ${output.markdownPath}`);

  const reportData = output.reportData;
  assert(reportData.siteId === "sc-domain:empregape.com.br", `siteId correto no reportData: ${reportData.siteId}`);
  assert(typeof reportData.executiveScore.current === "number", "Score executivo calculado");
  assert(typeof reportData.organicVisibility.impressions.current === "number", "Impressões orgânicas calculadas");

  // Critério de Aceite 2: Identificar a correção de 404 aplicada em 30/06/2026 como evento de atribuição
  assertIsArray(reportData.systemEvents, "systemEvents deve ser array");
  console.log(`  🔍 ${reportData.systemEvents.length} eventos do sistema identificados no período.`);

  const event404 = reportData.systemEvents.find(
    (e) => e.date === "2026-06-30" || e.actionType.toLowerCase().includes("404")
  );

  assert(event404 !== undefined, "Evento de correção de 404 em 30/06/2026 identificado no relatório");
  if (event404) {
    assert(event404.classification === "Positivo", `Classificação do evento 404 positiva (${event404.classification})`);
    assert(event404.primaryMetricChangePct > 0, `Variação pré/pós positiva: +${event404.primaryMetricChangePct}%`);
    assert(event404.urls.length > 0, "URLs afetadas pelo evento preenchidas");
  }
}

// ─── Suite 3: Persistência e Snapshots Distintos (Critério 3) ─────────────────

async function testSnapshotUniqueness() {
  console.log("\n📸 [Suite 3] Persistência em Snapshots (Critério de Aceite 3)");

  console.log("  Rodando primeira execução do relatório...");
  const run1 = await generateReport({ site: "empregape.com.br", granularity: "weekly" });

  console.log("  Rodando segunda execução do relatório para o mesmo período...");
  const run2 = await generateReport({ site: "empregape.com.br", granularity: "weekly" });

  assert(run1.jsonPath !== run2.jsonPath, "Arquivos de saída possuem caminhos/timestamps distintos");
  assert(run1.reportData.generatedAt !== run2.reportData.generatedAt, "Timestamps de geração distintos");

  if (run1.snapshotId && run2.snapshotId) {
    assert(run1.snapshotId !== run2.snapshotId, `Snapshots no Supabase possuem IDs distintos (${run1.snapshotId} != ${run2.snapshotId})`);
  } else {
    console.log("  ℹ️ Executado sem conexão Supabase ativa — caminhos de arquivos locais validados.");
  }
}

// ─── Suite 4: Suporte a Múltiplos Sites e Granularidades ──────────────────────

async function testMultipleSitesAndGranularities() {
  console.log("\n🌐 [Suite 4] Suporte a Múltiplos Sites e Granularidades");

  const sites = ["brasilcalculadoras.com.br", "mestredafederal.com.br", "toolbrasil.com.br"];
  const granularities: Array<"daily" | "monthly"> = ["daily", "monthly"];

  for (const site of sites) {
    for (const gran of granularities) {
      console.log(`  Gerando relatório ${gran} para ${site}...`);
      const output = await generateReport({ site, granularity: gran });
      assert(fs.existsSync(output.jsonPath), `JSON gerado para ${site} (${gran})`);
    }
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runAllReportBuilderTests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Suite de Testes — Módulo de Relatórios & Atribuição (BI 6.0)");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    testPeriodAndMetricCalculations();
    await testReportGenerationAndAttribution();
    await testSnapshotUniqueness();
    await testMultipleSitesAndGranularities();
  } catch (err: any) {
    console.error("\n💥 Erro inesperado durante os testes do ReportBuilder:", err.message);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  const total = passed + failed;
  console.log(`  RESULTADO FINAL: ${passed}/${total} testes passaram.`);

  if (failed > 0) {
    console.error(`  ❌ ${failed} TESTES FALHARAM`);
    process.exit(1);
  } else {
    console.log(`  ✅ TODOS OS ${passed} TESTES PASSARAM — MÓDULO REPORTBUILDER VALIDADO`);
    process.exit(0);
  }
}

runAllReportBuilderTests();

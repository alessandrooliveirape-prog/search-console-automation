/**
 * Tests 5.0 Enterprise BI — Smart Alerts, Editorial Calendar & Content Publisher
 * Execução: tsx tests/bi5.test.ts
 */

import { runSmartAlertsEngine } from "../src/bi/smartAlerts";
import { generateEditorialCalendar, fetchEditorialCalendar } from "../src/bi/editorialCalendar";
import { runContentPublisher, fetchRecentPublications } from "../src/bi/contentPublisher";

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

function assertNotNull(value: any, message: string) {
  assert(value !== null && value !== undefined, message);
}

function assertIsArray(value: any, message: string) {
  assert(Array.isArray(value), `${message} (tipo: ${typeof value})`);
}

function assertNumber(value: any, message: string) {
  assert(typeof value === "number" && !isNaN(value), `${message} (valor: ${value})`);
}

// ─── Suite 1: Smart Alerts Engine ─────────────────────────────────────────────

async function testSmartAlertsEngine() {
  console.log("\n🔔 [Suite 1] Smart Alerts Engine");

  console.log("  Verificando execução do motor de alertas...");
  const alerts = await runSmartAlertsEngine();
  
  assertIsArray(alerts, "runSmartAlertsEngine() deve retornar um array");
  
  // Sem dados históricos suficientes (ambiente de teste), deve retornar array vazio ou alertas
  for (const alert of alerts) {
    assert(
      ["CRÍTICO", "ALERTA", "INFO"].includes(alert.severity),
      `Severity deve ser válida: ${alert.severity}`
    );
    assert(
      ["SEO", "CTR", "POSIÇÃO", "FORECAST", "RECEITA", "SCORE"].includes(alert.category),
      `Category deve ser válida: ${alert.category}`
    );
    assert(typeof alert.title === "string" && alert.title.length > 0, "Alerta deve ter título");
    assert(typeof alert.suggestion === "string", "Alerta deve ter sugestão");
    assertNumber(alert.changePercent, "changePercent deve ser número");
    assert(alert.triggeredAt.length > 0, "triggeredAt deve estar preenchido");
  }

  console.log(`  📊 ${alerts.length} alertas gerados (pode ser 0 sem dados históricos suficientes).`);
}

// ─── Suite 2: Editorial Calendar ──────────────────────────────────────────────

async function testEditorialCalendar() {
  console.log("\n📅 [Suite 2] Editorial Calendar IA");

  // Testa geração do calendário
  console.log("  Testando geração do calendário editorial...");
  const calendars = await generateEditorialCalendar();
  
  assertIsArray(calendars, "generateEditorialCalendar() deve retornar array");

  for (const cal of calendars) {
    assert(typeof cal.siteId === "string" && cal.siteId.length > 0, `siteId preenchido: ${cal.siteId}`);
    assert(typeof cal.month === "string" && /^\d{4}-\d{2}$/.test(cal.month), `month formato válido: ${cal.month}`);
    assertIsArray(cal.slots, "slots deve ser array");
    assert(typeof cal.totalSlots === "number", "totalSlots deve ser número");
    assert(cal.totalSlots === cal.slots.length, "totalSlots deve bater com slots.length");

    for (const slot of cal.slots) {
      assert(typeof slot.title === "string" && slot.title.length > 0, `Slot deve ter título: ${slot.title}`);
      assert(typeof slot.mainKeyword === "string", "Slot deve ter keyword principal");
      assert(["NOVO", "ATUALIZAÇÃO", "REPAGINAÇÃO", "SÉRIE"].includes(slot.type), `Tipo válido: ${slot.type}`);
      assert(["URGENTE", "ALTA", "MÉDIA", "BAIXA"].includes(slot.priority), `Prioridade válida: ${slot.priority}`);
      assertNumber(slot.estimatedClicks, "estimatedClicks deve ser número");
      assert(typeof slot.cluster === "string", "Slot deve ter cluster");
    }
  }

  // Testa fetch do calendário
  console.log("  Testando fetchEditorialCalendar...");
  const slots = await fetchEditorialCalendar("sc-domain:empregape.com.br");
  assertIsArray(slots, "fetchEditorialCalendar() deve retornar array");

  console.log(`  📅 ${calendars.length} calendários gerados, ${calendars.reduce((a, c) => a + c.slots.length, 0)} slots totais.`);
}

// ─── Suite 3: Content Publisher ───────────────────────────────────────────────

async function testContentPublisher() {
  console.log("\n📝 [Suite 3] Content Publisher");

  console.log("  Testando identificação de candidatos...");
  const result = await runContentPublisher();
  
  assertNotNull(result, "runContentPublisher() deve retornar objeto");
  assert(typeof result.candidatesFound === "number", "candidatesFound deve ser número");
  assert(typeof result.requestsSent === "number", "requestsSent deve ser número");
  assert(result.candidatesFound >= 0, "candidatesFound deve ser >= 0");
  assert(result.requestsSent >= 0, "requestsSent deve ser >= 0");
  assert(result.requestsSent <= result.candidatesFound, "requestsSent <= candidatesFound");

  // Testa fetch de publicações recentes
  console.log("  Testando fetchRecentPublications...");
  const publications = await fetchRecentPublications("sc-domain:empregape.com.br");
  assertIsArray(publications, "fetchRecentPublications() deve retornar array");

  for (const pub of publications) {
    assert(typeof pub.siteId === "string", "Publicação deve ter siteId");
    assert(typeof pub.url === "string", "Publicação deve ter URL");
    assert(
      ["PENDENTE_APROVAÇÃO", "APROVADO", "PUBLICADO", "IGNORADO", "ERRO"].includes(pub.status),
      `Status válido: ${pub.status}`
    );
    assert(typeof pub.optimizedTitle === "string", "Publicação deve ter título otimizado");
    assert(typeof pub.estimatedClickGain === "number", "Publicação deve ter ganho estimado");
  }

  console.log(`  📝 ${result.candidatesFound} candidatos encontrados, ${result.requestsSent} aprovações enviadas.`);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runAllBi5Tests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Suite de Testes — BI 5.0 Enterprise (Smart Alerts + Editorial + Publisher)");
  console.log("═══════════════════════════════════════════════════════════════");

  try {
    await testSmartAlertsEngine();
    await testEditorialCalendar();
    await testContentPublisher();
  } catch (err: any) {
    console.error("\n💥 Erro inesperado durante os testes:", err.message);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  const total = passed + failed;
  console.log(`  RESULTADO FINAL: ${passed}/${total} testes passaram.`);

  if (failed > 0) {
    console.error(`  ❌ ${failed} TESTES FALHARAM`);
    process.exit(1);
  } else {
    console.log(`  ✅ TODOS OS ${passed} TESTES PASSARAM — BI 5.0 VALIDADO`);
    process.exit(0);
  }
}

runAllBi5Tests();

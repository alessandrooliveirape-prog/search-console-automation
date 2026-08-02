import { publishToWordPress } from "../src/services/wordpressPublisher";
import { sendIndexNowPing } from "../src/services/indexNow";
import { processWhatsAppCommand } from "../src/services/whatsappListener";
import { runTrafficDropDetector } from "../src/analyzers/trafficDropDetector";
import { runAbTestingEngine } from "../src/bi/abTestingEngine";

async function testEnterpriseEnhancements() {
  console.log("===========================================================");
  console.log("  Suite de Testes — 5 Melhorias Enterprise & Automação");
  console.log("===========================================================\n");

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASSOU: ${description}`);
      passedCount++;
    } else {
      console.error(`  ❌ FALHOU: ${description}`);
      process.exitCode = 1;
    }
  }

  // 1. Teste do WordPress REST API Publisher
  console.log("📝 [Suite 1] WordPress REST API Publisher");
  const wpRes = await publishToWordPress({
    url: "https://empregape.com.br/vagas/recife-pe",
    title: "💼 Vagas de Emprego em Recife Hoje | Envie seu Currículo!",
    metaDescription: "Confira as melhores vagas em Recife atualizadas hoje."
  });
  assert(typeof wpRes.success === "boolean", "publishToWordPress deve retornar boolean em success");
  assert(typeof wpRes.message === "string", "publishToWordPress deve retornar mensagem informativa");

  // 2. Teste do IndexNow Protocol Ping
  console.log("\n⚡ [Suite 2] IndexNow Instant Protocol Ping");
  const inRes = await sendIndexNowPing({
    host: "empregape.com.br",
    urlList: ["https://empregape.com.br/vagas/recife-pe"]
  });
  assert(typeof inRes.success === "boolean", "sendIndexNowPing deve retornar status boolean");
  assert(typeof inRes.message === "string", "sendIndexNowPing deve retornar mensagem da API");

  // 3. Teste do Traffic Drop Detector (WoW)
  console.log("\n🚨 [Suite 3] Detector Preditivo de Queda de Tráfego (WoW)");
  const drops = await runTrafficDropDetector();
  assert(Array.isArray(drops), "runTrafficDropDetector deve retornar um array de alertas");

  // 4. Teste do Processador de Comandos Interativos WhatsApp
  console.log("\n💬 [Suite 4] Comandos Interativos WhatsApp");
  const cmdStatus = await processWhatsAppCommand("status");
  assert(cmdStatus.handled === true, "Comando 'status' no WhatsApp deve ser reconhecido");
  assert(cmdStatus.replyMessage.includes("Status do Sistema"), "Mensagem do WhatsApp deve conter resumo de status");

  const cmdHelp = await processWhatsAppCommand("ajuda");
  assert(cmdHelp.handled === true, "Comando 'ajuda' no WhatsApp deve ser reconhecido");

  // 5. Teste do A/B Testing Auto-Rollback Engine
  console.log("\n🔄 [Suite 5] A/B Testing Engine & Auto-Rollback");
  const abResults = await runAbTestingEngine();
  assert(Array.isArray(abResults), "runAbTestingEngine deve retornar lista de testes avaliados");

  console.log("\n===========================================================");
  console.log(`  RESULTADO FINAL: ${passedCount}/${totalTests} testes passaram.`);
  if (passedCount === totalTests) {
    console.log("  ✅ TODOS OS TESTES DAS 5 MELHORIAS ENTERPRISE PASSARAM!");
  } else {
    console.error("  ❌ ALGUNS TESTES FALHARAM.");
  }
  console.log("===========================================================\n");
}

testEnterpriseEnhancements().catch((err) => {
  console.error("Erro fatal na execução da suíte de testes:", err);
  process.exit(1);
});

import { withRetry, CircuitBreaker } from "../src/services/resilience";

async function testResilience() {
  let attempts = 0;
  const result = await withRetry("testAction", async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error("Simulated transient error");
    }
    return "ok";
  }, { maxRetries: 3, initialDelayMs: 10 });

  if (result !== "ok" || attempts !== 2) {
    throw new Error("Falha no teste de Retry");
  }

  const breaker = new CircuitBreaker(2, 1000);
  let breakerWorked = false;
  try {
    await breaker.execute("testCb", async () => { throw new Error("Err 1"); });
  } catch (e) {}
  try {
    await breaker.execute("testCb", async () => { throw new Error("Err 2"); });
  } catch (e) {}

  if (breaker.getState() === "OPEN") {
    breakerWorked = true;
  }

  if (!breakerWorked) {
    throw new Error("Falha no teste de Circuit Breaker");
  }

  console.log("✔ Teste de Resiliência (Retry & CircuitBreaker): PASSOU");
}

testResilience().catch((err) => {
  console.error("❌ Teste de Resiliência FALHOU:", err);
  process.exit(1);
});

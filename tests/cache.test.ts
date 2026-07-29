import { MemoryCache } from "../src/services/cache";

async function testCache() {
  const cache = new MemoryCache();
  cache.set("key1", { value: 123 }, 2, 5);

  const val1 = cache.get<{ value: number }>("key1");
  if (!val1 || val1.value !== 123) {
    throw new Error("Falha no teste de leitura do cache");
  }

  console.log("✔ Teste de Cache em Memória: PASSOU");
}

testCache().catch((err) => {
  console.error("❌ Teste de Cache FALHOU:", err);
  process.exit(1);
});

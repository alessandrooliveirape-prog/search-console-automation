import { siteProperties } from "../config/sites";
import { supabase } from "../config/supabase";

export type PositionShiftItem = {
  keyword: string;
  url: string;
  oldPosition: number;
  newPosition: number;
  shiftDelta: number; // positivo = ganhou posições, negativo = perdeu
  competitorGained: boolean;
  status: "Subiu" | "Caiu" | "Estável";
};

export type CompetitiveReport = {
  siteId: string;
  gainedPositionsCount: number;
  lostPositionsCount: number;
  suddenShiftAlerts: PositionShiftItem[];
  executiveSummary: string;
};

export async function runCompetitiveIntelligence(siteId: string): Promise<CompetitiveReport> {
  // Período atual: últimos 7 dias
  const now = new Date();
  const endCurrent = new Date(now);
  endCurrent.setDate(endCurrent.getDate() - 1);
  const startCurrent = new Date(now);
  startCurrent.setDate(startCurrent.getDate() - 7);

  // Período anterior: 7 dias antes do período atual
  const endPrev = new Date(startCurrent);
  endPrev.setDate(endPrev.getDate() - 1);
  const startPrev = new Date(endPrev);
  startPrev.setDate(startPrev.getDate() - 7);

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  // Busca dados do período atual por query+page
  const { data: currentRows } = await supabase
    .from("gsc_performance")
    .select("query, page, clicks, impressions, position")
    .eq("site_id", siteId)
    .gte("date", fmtDate(startCurrent))
    .lte("date", fmtDate(endCurrent))
    .gte("impressions", 50)
    .order("impressions", { ascending: false })
    .limit(500);

  // Busca dados do período anterior
  const { data: prevRows } = await supabase
    .from("gsc_performance")
    .select("query, page, clicks, impressions, position")
    .eq("site_id", siteId)
    .gte("date", fmtDate(startPrev))
    .lte("date", fmtDate(endPrev))
    .gte("impressions", 50)
    .order("impressions", { ascending: false })
    .limit(500);

  if (!currentRows || currentRows.length === 0) {
    console.warn(`[Competitive] Sem dados de período atual para ${siteId}`);
    return {
      siteId,
      gainedPositionsCount: 0,
      lostPositionsCount: 0,
      suddenShiftAlerts: [],
      executiveSummary: `⚠️ Sem dados suficientes no período atual para análise competitiva de ${siteId}.`,
    };
  }

  // Agrega posições médias por query+page no período atual
  const currentMap: Record<string, { position: number; page: string; impressions: number }> = {};
  for (const r of currentRows) {
    const key = `${r.query}|||${r.page}`;
    if (!currentMap[key]) {
      currentMap[key] = { position: r.position || 0, page: r.page, impressions: r.impressions || 0 };
    }
  }

  // Agrega posições médias por query+page no período anterior
  const prevMap: Record<string, number> = {};
  for (const r of (prevRows || [])) {
    const key = `${r.query}|||${r.page}`;
    if (!prevMap[key]) {
      prevMap[key] = r.position || 0;
    }
  }

  // Calcula shifts
  const shifts: PositionShiftItem[] = [];
  let gained = 0;
  let lost = 0;

  for (const [key, current] of Object.entries(currentMap)) {
    const [keyword] = key.split("|||");
    if (!prevMap[key]) continue; // sem histórico para comparar

    const oldPos = prevMap[key];
    const newPos = current.position;
    const delta = Number((oldPos - newPos).toFixed(1)); // positivo = subiu

    if (Math.abs(delta) < 0.3) continue; // mudanças pequenas ignoradas

    const status: "Subiu" | "Caiu" | "Estável" = delta > 0 ? "Subiu" : "Caiu";
    if (status === "Subiu") gained++;
    else lost++;

    // Alerta para mudanças bruscas (> 3 posições) ou quedas significativas
    if (Math.abs(delta) >= 2 || (delta < 0 && current.impressions > 1000)) {
      shifts.push({
        keyword,
        url: current.page,
        oldPosition: Number(oldPos.toFixed(1)),
        newPosition: Number(newPos.toFixed(1)),
        shiftDelta: delta,
        competitorGained: delta < 0,
        status,
      });
    }
  }

  // Ordena por magnitude da mudança
  shifts.sort((a, b) => Math.abs(b.shiftDelta) - Math.abs(a.shiftDelta));
  const topShifts = shifts.slice(0, 10);

  const executiveSummary = currentRows.length > 0
    ? `📊 **Análise Competitiva (${fmtDate(startCurrent)} → ${fmtDate(endCurrent)})**: ` +
      `${gained} keywords ganharam posição, ${lost} perderam. ` +
      (topShifts.filter(s => s.status === "Caiu").length > 0
        ? `⚠️ ${topShifts.filter(s => s.status === "Caiu").length} páginas com queda brusca detectadas.`
        : `✅ Nenhuma queda brusca detectada.`)
    : `⚠️ Dados insuficientes para análise competitiva.`;

  return {
    siteId,
    gainedPositionsCount: gained,
    lostPositionsCount: lost,
    suddenShiftAlerts: topShifts,
    executiveSummary,
  };
}

import { saveJson } from "./files";

export async function logAlert(type: string, payload: unknown) {
  console.log(`[ALERT] ${type}`, payload);
  await saveJson("reports/alerts", `${type}-${Date.now()}`, payload);
}

import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export type LogCategory = "system" | "cron" | "gsc" | "ga4" | "gemini" | "telegram" | "errors";

export function logEvent(
  category: LogCategory,
  level: "INFO" | "WARN" | "ERROR",
  action: string,
  details: {
    durationMs?: number;
    success?: boolean;
    payload?: any;
    error?: any;
  } = {}
) {
  const timestamp = new Date().toISOString();
  const successStr = details.success !== undefined ? `[SUCCESS=${details.success}]` : "";
  const durationStr = details.durationMs !== undefined ? `[DURATION=${details.durationMs}ms]` : "";
  const payloadStr = details.payload ? `[PAYLOAD=${JSON.stringify(details.payload)}]` : "";
  const errStr = details.error ? `[ERROR=${details.error?.message || details.error}]` : "";
  const stackStr = details.error?.stack ? `\nSTACK: ${details.error.stack}` : "";

  const logLine = `[${timestamp}] [${level.padEnd(5)}] [${action}] ${successStr} ${durationStr} ${payloadStr} ${errStr}${stackStr}\n`;

  // Write to category specific log file
  const categoryFilePath = path.join(LOGS_DIR, `${category}.log`);
  fs.appendFileSync(categoryFilePath, logLine, "utf8");

  // If level is ERROR, also write to errors.log
  if (level === "ERROR" && category !== "errors") {
    const errorFilePath = path.join(LOGS_DIR, "errors.log");
    fs.appendFileSync(errorFilePath, `[CATEGORY=${category}] ${logLine}`, "utf8");
  }

  // Also log to console in concise format
  console.log(`[${category.toUpperCase()}] [${level}] ${action} ${durationStr}`);
}

export function getRecentLogs(category: LogCategory, linesCount = 50): string {
  const filePath = path.join(LOGS_DIR, `${category}.log`);
  if (!fs.existsSync(filePath)) return "Nenhum log registrado ainda.";

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(-linesCount).join("\n");
  } catch (e: any) {
    return `Erro ao ler logs: ${e.message}`;
  }
}

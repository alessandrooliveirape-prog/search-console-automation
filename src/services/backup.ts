import fs from "fs";
import path from "path";
import { supabase } from "../config/supabase";
import { logEvent } from "./logger";
import { updateSyncTimestamp } from "./systemStatus";

const BACKUPS_DIR = path.join(process.cwd(), "backups");

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export type BackupSummary = {
  timestamp: string;
  backupFolder: string;
  tablesBackedUp: string[];
  totalRecords: number;
};

export async function runAutomatedBackup(): Promise<BackupSummary> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folderName = `backup-${timestamp}`;
  const backupFolderPath = path.join(BACKUPS_DIR, folderName);

  fs.mkdirSync(backupFolderPath, { recursive: true });

  const tablesToBackup = [
    "gsc_performance",
    "gsc_indexing_audit",
    "gsc_sitemaps",
    "seo_overrides",
    "seo_scores",
    "ga4_metrics",
    "seo_predictions",
    "seo_opportunities",
    "seo_keywords",
    "ai_daily_insights",
    "system_logs",
  ];

  let totalRecords = 0;
  const tablesBackedUp: string[] = [];

  for (const table of tablesToBackup) {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(5000);
      if (!error && Array.isArray(data)) {
        const filePath = path.join(backupFolderPath, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        totalRecords += data.length;
        tablesBackedUp.push(table);
      }
    } catch (e: any) {
      logEvent("errors", "WARN", `Falha ao fazer backup da tabela ${table}: ${e.message}`);
    }
  }

  // Backup configuration
  try {
    const configDir = path.join(process.cwd(), "src", "config");
    const backupConfigDir = path.join(backupFolderPath, "config");
    if (fs.existsSync(configDir)) {
      fs.cpSync(configDir, backupConfigDir, { recursive: true });
    }
  } catch (e) {
    // Ignore config backup error
  }

  updateSyncTimestamp("backup");
  logEvent("system", "INFO", `Backup Automático Concluído em ${folderName} (${totalRecords} registros)`, { success: true });

  return {
    timestamp,
    backupFolder: folderName,
    tablesBackedUp,
    totalRecords,
  };
}

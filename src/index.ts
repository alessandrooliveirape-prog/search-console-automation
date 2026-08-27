import cron from "node-cron";
import { runDailyPerformanceJob } from "./jobs/dailyPerformanceJob";
import { runUrlAuditJob } from "./jobs/urlAuditJob";
import { runSitemapCheckJob } from "./jobs/sitemapCheckJob";
import { runRebuildWebsitesJob } from "./jobs/rebuildWebsitesJob";
import { runTrackPerformanceJob } from "./jobs/trackPerformanceJob";
import { runAutoRemediateJob } from "./jobs/autoRemediateJob";
import { runContentDecayJob } from "./jobs/contentDecayJob";
import { runFeaturedSnippetJob } from "./jobs/featuredSnippetJob";
import { startTelegramBotListener } from "./services/telegramListener";
import { runSeoScoreCalculation } from "./services/seoScore";
import { runGa4SyncJob } from "./services/ga4Analytics";
import { runPredictiveAiJob } from "./services/predictiveAi";
import { runOpportunitiesJob } from "./services/opportunities";
import { runKeywordsJob } from "./services/keywordsExplorer";
import { runAiDailyInsightsJob } from "./services/aiDailyInsights";
import { checkEnterpriseSystemHealth } from "./services/monitoring";
import { runAutomatedBackup } from "./services/backup";
import { runSystemWatchdog } from "./services/watchdog";
import { runCompleteBiEngine } from "./bi/biOrchestrator";

async function main() {
  console.log("Serviço de Automação do Google Search Console & Enterprise SEO BI 6.0 iniciado.");

  // Se o script for chamado com '--run-now' ou 'run', executa imediatamente e finaliza.
  if (process.argv.includes("--run-now") || process.argv.includes("run")) {
    console.log("--- Execução Manual Imediata Iniciada ---");
    try {
      await runDailyPerformanceJob();
    } catch (e: any) {
      console.error("Erro no Daily Performance Job:", e.message || e);
    }
    
    try {
      await runUrlAuditJob();
    } catch (e: any) {
      console.error("Erro no URL Audit Job:", e.message || e);
    }
    
    try {
      await runSitemapCheckJob();
    } catch (e: any) {
      console.error("Erro no Sitemap Check Job:", e.message || e);
    }

    try {
      await runRebuildWebsitesJob();
    } catch (e: any) {
      console.error("Erro no Rebuild Websites Job:", e.message || e);
    }

    try {
      await runTrackPerformanceJob();
    } catch (e: any) {
      console.error("Erro no Track Performance Job:", e.message || e);
    }

    try {
      await runContentDecayJob();
    } catch (e: any) {
      console.error("Erro no Content Decay Job:", e.message || e);
    }

    try {
      await runFeaturedSnippetJob();
    } catch (e: any) {
      console.error("Erro no Featured Snippet Job:", e.message || e);
    }

    try {
      await runAutoRemediateJob();
    } catch (e: any) {
      console.error("Erro no Auto Remediate Job:", e.message || e);
    }

    // Execuções dos módulos Enterprise BI 6.0:
    try {
      await runSeoScoreCalculation();
      await runGa4SyncJob();
      await runPredictiveAiJob();
      await runOpportunitiesJob();
      await runKeywordsJob();
      await runAiDailyInsightsJob();
      await checkEnterpriseSystemHealth();
      await runAutomatedBackup();
      await runSystemWatchdog();
      await runCompleteBiEngine();
    } catch (e: any) {
      console.error("Erro nos serviços Enterprise BI:", e.message || e);
    }
    
    console.log("--- Execução Manual Imediata Concluída ---");
    process.exit(0);
  }

  // Inicia escuta do bot Telegram para aprovações interativas
  await startTelegramBotListener();

  // Agendamento diário:

  // 0. Backup Automático diário às 02:00
  cron.schedule("0 2 * * *", async () => {
    console.log("[Scheduler] Iniciando Backup Automático diário");
    try {
      await runAutomatedBackup();
    } catch (e: any) {
      console.error("[Scheduler] Erro no Backup Automático:", e.message || e);
    }
  });

  // 1. Daily Performance Job e Módulos Enterprise às 07:00
  cron.schedule("0 7 * * *", async () => {
    console.log("[Scheduler] Iniciando dailyPerformanceJob e Módulos Enterprise");
    try {
      await runDailyPerformanceJob();
      await runSeoScoreCalculation();
      await runGa4SyncJob();
      await runPredictiveAiJob();
      await runOpportunitiesJob();
      await runKeywordsJob();
      await runAiDailyInsightsJob();
      await runCompleteBiEngine();
    } catch (e: any) {
      console.error("[Scheduler] Erro no dailyPerformanceJob e BI:", e.message || e);
    }
  });

  // 2. URL Audit Job às 07:30
  cron.schedule("30 7 * * *", async () => {
    console.log("[Scheduler] Iniciando urlAuditJob");
    try {
      await runUrlAuditJob();
    } catch (e: any) {
      console.error("[Scheduler] Erro no urlAuditJob:", e.message || e);
    }
  });

  // 3. Sitemap Check Job às 08:00
  cron.schedule("0 8 * * *", async () => {
    console.log("[Scheduler] Iniciando sitemapCheckJob");
    try {
      await runSitemapCheckJob();
    } catch (e: any) {
      console.error("[Scheduler] Erro no sitemapCheckJob:", e.message || e);
    }
  });

  // 4. Auto Remediate & Indexing API Job às 08:30
  cron.schedule("30 8 * * *", async () => {
    console.log("[Scheduler] Iniciando runAutoRemediateJob");
    try {
      await runAutoRemediateJob();
    } catch (e: any) {
      console.error("[Scheduler] Erro no runAutoRemediateJob:", e.message || e);
    }
  });

  // 5. Rebuild Websites Job a cada 1 hora (minuto 0)
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Iniciando runRebuildWebsitesJob");
    try {
      await runRebuildWebsitesJob();
    } catch (e: any) {
      console.error("[Scheduler] Erro no runRebuildWebsitesJob:", e.message || e);
    }
  });

  // 6. Watchdog de Produção a cada 6 horas
  cron.schedule("0 */6 * * *", async () => {
    console.log("[Scheduler] Executando Watchdog de Produção");
    try {
      await checkEnterpriseSystemHealth();
      await runSystemWatchdog();
    } catch (e: any) {
      console.error("[Scheduler] Erro no Watchdog:", e.message || e);
    }
  });

  // 7. Track Performance Job, Content Decay e Featured Snippets todo Domingo às 09:00
  cron.schedule("0 9 * * 0", async () => {
    console.log("[Scheduler] Iniciando Auditoria Semanal de Performance e Conteúdo");
    try {
      await runTrackPerformanceJob();
      await runContentDecayJob();
      await runFeaturedSnippetJob();
    } catch (e: any) {
      console.error("[Scheduler] Erro nos Jobs Semanais de Performance:", e.message || e);
    }
  });

  console.log("Cron jobs agendados com sucesso:");
  console.log("- 02:00: Backup Automático diário do banco e configurações (runAutomatedBackup)");
  console.log("- 07:00: Relatório diário de performance, IA Preditiva, GA4, SEO Score e BI Orchestrator");
  console.log("- 07:30: Auditoria de indexação de URLs (urlAuditJob)");
  console.log("- 08:00: Verificação de Sitemaps (sitemapCheckJob)");
  console.log("- 08:30: Auto-Cura de Erros e Google Indexing API (autoRemediateJob)");
  console.log("- A cada hora: Reconstrução estática SSG de sites aprovados (rebuildWebsitesJob)");
  console.log("- A cada 6 horas: Monitoramento de saúde e Watchdog (checkEnterpriseSystemHealth & runSystemWatchdog)");
  console.log("- Domingo às 09:00: Acompanhamento Antes vs Depois, Content Decay e Caça de Featured Snippets");
  console.log("Aguardando horários agendados...");
}

main().catch((err) => {
  console.error("Erro fatal na inicialização:", err);
  process.exit(1);
});



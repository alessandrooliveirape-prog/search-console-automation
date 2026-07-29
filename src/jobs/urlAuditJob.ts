import { siteProperties } from "../config/sites";
import { inspectUrl } from "../services/urlInspection";
import { summarizeIndexing } from "../analyzers/indexingIssues";
import { saveJson, saveCsv } from "../outputs/files";
import { supabase } from "../config/supabase";
import fs from "node:fs/promises";
import path from "node:path";

async function loadUrls() {
  const folder = "data";
  const file = path.join(folder, "urls.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as { siteId: string; url: string }[];
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log(`[Job] Arquivo data/urls.json não encontrado. Criando arquivo de exemplo.`);
      await fs.mkdir(folder, { recursive: true });
      const defaultUrls = [
        { siteId: "sc-domain:empregape.com.br", url: "https://empregape.com.br/" },
        { siteId: "https://www.mestredafederal.com.br/", url: "https://www.mestredafederal.com.br/" }
      ];
      await fs.writeFile(file, JSON.stringify(defaultUrls, null, 2), "utf-8");
      return defaultUrls;
    }
    throw err;
  }
}

export async function runUrlAuditJob() {
  console.log("[Job] Executando urlAuditJob");
  const urls = await loadUrls();
  const results: Record<string, any[]> = {};

  for (const item of urls) {
    const site = siteProperties.find((s) => s.id === item.siteId);
    if (!site) {
      console.warn(`[Job] Propriedade do site não encontrada para siteId: ${item.siteId}`);
      continue;
    }

    try {
      console.log(`[Job] Inspecionando URL: ${item.url} no site ${site.name}`);
      const res = await inspectUrl(site.id, item.url);
      const summary = summarizeIndexing(res);

      const auditData = {
        url: item.url,
        raw: res,
        summary,
      };

      if (!results[site.name]) results[site.name] = [];
      results[site.name].push(auditData);

      // 1. Gravar no Supabase (upsert para evitar duplicatas)
      if (summary) {
        const { error } = await supabase.from("gsc_indexing_audit").upsert({
          site_id: site.id,
          url: item.url,
          last_checked_at: new Date().toISOString(),
          indexed: summary.verdict === "INDEXED",
          canonical: (res?.inspectionResult?.indexStatusResult as any)?.googleCanonical || null,
          coverage_state: summary.coverageState || null,
          issues: summary.pageFetchState !== "SUCCESSFUL" ? `Fetch State: ${summary.pageFetchState}` : null,
        }, { onConflict: "site_id,url" });

        if (error) {
          console.error(`[Job] Erro ao salvar auditoria no Supabase para ${item.url}:`, error.message);
        } else {
          console.log(`[Job] Auditoria salva no Supabase para: ${item.url}`);
        }
      }
    } catch (err: any) {
      console.error(`[Job] Erro ao inspecionar URL ${item.url}:`, err?.message || err);
    }
  }

  // 2. Salvar localmente em JSON e CSV
  for (const [siteName, siteResults] of Object.entries(results)) {
    const folderName = `reports/${siteName.replace(/\s+/g, "-").toLowerCase()}`;
    const fileName = `url-audit-${Date.now()}`;
    
    await saveJson(folderName, fileName, siteResults);
    
    // Simplifica a estrutura para CSV
    const csvData = siteResults.map(r => ({
      url: r.url,
      verdict: r.summary?.verdict || "UNKNOWN",
      coverageState: r.summary?.coverageState || "",
      indexingState: r.summary?.indexingState || "",
      lastCrawlTime: r.summary?.lastCrawlTime || "",
      pageFetchState: r.summary?.pageFetchState || ""
    }));
    await saveCsv(folderName, fileName, csvData);
    
    console.log(`[Job] Auditoria local salva em ${folderName} para ${siteName}`);
  }
}

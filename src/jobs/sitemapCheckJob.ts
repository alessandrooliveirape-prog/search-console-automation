import { siteProperties } from "../config/sites";
import { listSitemaps } from "../services/sitemaps";
import { saveJson, saveCsv } from "../outputs/files";
import { logAlert } from "../outputs/alerts";
import { supabase } from "../config/supabase";

export async function runSitemapCheckJob() {
  console.log("[Job] Executando sitemapCheckJob");

  for (const site of siteProperties) {
    try {
      console.log(`[Job] Buscando sitemaps para: ${site.name}`);
      const sitemaps = await listSitemaps(site.id);

      console.log(`[Job] Encontrado(s) ${sitemaps.length} sitemaps para ${site.name}`);

      const folderName = `reports/${site.name.replace(/\s+/g, "-").toLowerCase()}`;
      const fileName = `sitemaps-${Date.now()}`;

      // Salvar localmente em JSON e CSV
      await saveJson(folderName, fileName, sitemaps);
      
      const csvData = sitemaps.map(s => {
        const sAny = s as any;
        return {
          path: sAny.path || "",
          lastSubmitted: sAny.lastSubmitted || "",
          lastDownloaded: sAny.lastDownloaded || "",
          isPending: sAny.isPending ?? false,
          warnings: sAny.warnings || 0,
          errors: sAny.errors || 0
        };
      });
      await saveCsv(folderName, fileName, csvData);

      // 1. Gravar no Supabase
      if (sitemaps && sitemaps.length > 0) {
        for (const sitemap of sitemaps) {
          const sitemapUrl = sitemap.path || "";
          if (!sitemapUrl) continue;

          const { error } = await supabase
            .from("gsc_sitemaps")
            .upsert({
              site_id: site.id,
              sitemap_url: sitemapUrl,
              last_seen: new Date().toISOString(),
              is_pending: sitemap.isPending ?? false
            }, { onConflict: "site_id,sitemap_url" });

          if (error) {
            console.error(`[Job] Erro ao salvar sitemap no Supabase para ${site.name}:`, error.message);
          } else {
            console.log(`[Job] Sitemap salvo/atualizado no Supabase: ${sitemapUrl}`);
          }
        }
      }

      if (!sitemaps || sitemaps.length === 0) {
        await logAlert(`sitemap-missing-${site.name}`, { site, sitemaps });
      }
    } catch (err: any) {
      console.error(`[Job] Erro no processamento de sitemaps para o site ${site.name}:`, err?.message || err);
    }
  }
}

import { exec } from "child_process";
import { supabase } from "../config/supabase";
import { sendWhatsAppAlert } from "../services/notifications";

type SiteBuildInfo = {
  directory: string;
  name: string;
};

const siteDirectoryMap: Record<string, SiteBuildInfo> = {
  "https://www.mestredafederal.com.br/": {
    directory: "d:\\sites\\Federal-jogo-do-bicho",
    name: "Mestre da Federal"
  },
  "sc-domain:brasilcalculadoras.com.br": {
    directory: "d:\\sites\\Socalculadoras",
    name: "Brasil Calculadoras"
  },
  "sc-domain:empregape.com.br": {
    directory: "d:\\sites\\Novo-emprega-pe",
    name: "Emprega PE"
  }
};

function executeBuild(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Rebuild] Executando 'npm run build' em: ${cwd}`);
    exec("npm run build", { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Rebuild] Erro no build de ${cwd}:`, stderr || error.message);
        reject(error);
      } else {
        console.log(`[Rebuild] Build concluído com sucesso em: ${cwd}`);
        resolve();
      }
    });
  });
}

export async function runRebuildWebsitesJob() {
  console.log("[Job] Buscando otimizações aprovadas pendentes de reconstrução (rebuilt = false)...");

  try {
    const { data: pendingOverrides, error } = await supabase
      .from("seo_overrides")
      .select("id, site_id, url, optimized_title")
      .eq("approved", true)
      .eq("rebuilt", false);

    if (error) {
      console.error("[Job] Erro ao buscar overrides pendentes de rebuild:", error.message);
      return;
    }

    if (!pendingOverrides || pendingOverrides.length === 0) {
      console.log("[Job] Nenhuma página pendente de reconstrução.");
      return;
    }

    console.log(`[Job] Encontrado(s) ${pendingOverrides.length} override(s) aprovado(s) para reconstruir.`);

    // Agrupa por site para não rodar múltiplos builds paralelos no mesmo diretório
    const sitesToRebuild = new Set<string>();
    for (const ov of pendingOverrides) {
      sitesToRebuild.add(ov.site_id);
    }

    for (const siteId of sitesToRebuild) {
      const buildInfo = siteDirectoryMap[siteId];
      if (!buildInfo) {
        console.log(`[Job] Projeto local não encontrado/configurado para site_id: ${siteId}. Pulando build.`);
        continue;
      }

      try {
        await executeBuild(buildInfo.directory);

        // Marca todos os overrides desse site como rebuilt = true
        const overridesOfSite = pendingOverrides.filter(ov => ov.site_id === siteId);
        const idsToUpdate = overridesOfSite.map(ov => ov.id);

        const { error: updateError } = await supabase
          .from("seo_overrides")
          .update({ rebuilt: true, updated_at: new Date().toISOString() })
          .in("id", idsToUpdate);

        if (updateError) {
          console.error(`[Job] Erro ao marcar overrides como reconstruídos no Supabase:`, updateError.message);
        } else {
          console.log(`[Job] Overrides marcados como reconstruídos para o site ${buildInfo.name}.`);
        }

        // Envia notificação no WhatsApp
        const urlsList = overridesOfSite.map(ov => ov.url.replace(/^https?:\/\/[^\/]+/, "")).join(", ");
        await sendWhatsAppAlert(`🚀 O site *${buildInfo.name}* foi reconstruído estaticamente com sucesso! Páginas otimizadas: ${urlsList}`);

      } catch (err: any) {
        console.error(`[Job] Falha crítica ao reconstruir o site ${buildInfo.name}:`, err.message || err);
        await sendWhatsAppAlert(`⚠️ *Erro de Compilação*: Falha ao reconstruir o site *${buildInfo.name}* após a aprovação de novas otimizações de SEO.`);
      }
    }
  } catch (err: any) {
    console.error("[Job] Falha ao rodar o job de rebuild:", err.message || err);
  }
}

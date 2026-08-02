import { siteProperties } from "../config/sites";
import { getSearchAnalytics } from "../services/searchAnalytics";
import { findCtrOpportunities } from "../analyzers/ctrOpportunities";
import { saveJson, saveCsv } from "../outputs/files";
import { logAlert } from "../outputs/alerts";
import { supabase } from "../config/supabase";
import { optimizeMetadata } from "../services/gemini";
import { sendTelegramApprovalRequest, sendAutoExecutionAlert } from "../services/notifications";


function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runDailyPerformanceJob() {
  const startDate = dateOffset(-7);
  const endDate = dateOffset(-1);

  console.log(`[Job] Executando dailyPerformanceJob de ${startDate} até ${endDate}`);

  for (const site of siteProperties) {
    try {
      console.log(`[Job] Buscando dados de performance para: ${site.name}`);
      const rows = await getSearchAnalytics({
        siteUrl: site.id,
        startDate,
        endDate,
        dimensions: ["date", "page", "query"],
        rowLimit: 25000,
      });

      console.log(`[Job] ${rows.length} linhas de performance recebidas para ${site.name}`);

      // 1. Gravar no Supabase (Histórico Diário)
      if (rows.length > 0) {
        const dbData = rows.map((r) => ({
          site_id: site.id,
          date: r.keys?.[0] ?? endDate,
          page: r.keys?.[1] ?? "",
          query: r.keys?.[2] ?? "",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        }));

        const chunkSize = 1000;
        let insertedCount = 0;
        for (let i = 0; i < dbData.length; i += chunkSize) {
          const chunk = dbData.slice(i, i + chunkSize);
          const { error } = await supabase
            .from("gsc_performance")
            .upsert(chunk, { onConflict: "site_id,date,page,query" });
          
          if (error) {
            console.error(`[Job] Erro ao salvar dados no Supabase para ${site.name}:`, error.message);
          } else {
            insertedCount += chunk.length;
          }
        }
        console.log(`[Job] Upsert de ${insertedCount} registros no Supabase concluído para ${site.name}`);
      }

      // 2. Agregar dados na memória para encontrar oportunidades de CTR
      const aggMap: Record<string, { clicks: number; impressions: number; positionsSum: number; count: number }> = {};
      for (const r of rows) {
        const page = r.keys?.[1] ?? "";
        const query = r.keys?.[2] ?? "";
        const key = `${page}|||${query}`;
        if (!aggMap[key]) {
          aggMap[key] = { clicks: 0, impressions: 0, positionsSum: 0, count: 0 };
        }
        const item = aggMap[key];
        item.clicks += r.clicks ?? 0;
        item.impressions += r.impressions ?? 0;
        item.positionsSum += (r.position ?? 0) * (r.impressions ?? 0);
        item.count += r.impressions ?? 0;
      }

      const aggregatedRows = Object.entries(aggMap).map(([key, item]) => {
        const [page, query] = key.split("|||");
        const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
        const position = item.count > 0 ? item.positionsSum / item.count : 0;
        return {
          keys: [page, query],
          clicks: item.clicks,
          impressions: item.impressions,
          ctr,
          position,
        };
      });

      const opportunities = findCtrOpportunities(aggregatedRows);
      
      const folderName = `reports/${site.name.replace(/\s+/g, "-").toLowerCase()}`;
      const fileName = `ctr-opportunities-${startDate}-${endDate}`;

      // Salvar local em JSON e CSV
      await saveJson(folderName, fileName, opportunities);
      await saveCsv(folderName, fileName, opportunities);
      
      console.log(`[Job] Oportunidades de CTR salvas em ${folderName} para ${site.name}`);

      // 3. Processar Oportunidades com Agente de SEO IA (Gemini)
      // Limitamos às 5 principais oportunidades para evitar sobrecarga ou lentidão excessiva
      const topOpportunities = opportunities.slice(0, 5);
      if (topOpportunities.length > 0) {
        console.log(`[Job] Agente de SEO IA processando ${topOpportunities.length} oportunidades para ${site.name}...`);
        
        for (const op of topOpportunities) {
          // Verifica se já existe um override aprovado para esta URL
          const { data: existingOverride } = await supabase
            .from("seo_overrides")
            .select("approved")
            .eq("site_id", site.id)
            .eq("url", op.page)
            .maybeSingle();

          if (existingOverride?.approved) {
            console.log(`[SEO Agent] Pulando URL já aprovada: ${op.page}`);
            continue;
          }

          console.log(`[SEO Agent] Otimizando metadados para: ${op.page} (foco em: "${op.query}")`);

          // Tenta ler o HTML atual do site para pegar o Title e a Description atual (Before/After)
          let originalTitle: string | null = null;
          let originalMeta: string | null = null;
          try {
            if (op.page.startsWith("http")) {
              const pageRes = await fetch(op.page);
              if (pageRes.ok) {
                const html = await pageRes.text();
                const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
                if (titleMatch) originalTitle = titleMatch[1].trim();
                
                const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || 
                                  html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
                if (metaMatch) originalMeta = metaMatch[1].trim();
              }
            }
          } catch (e) {
            // Ignora se der erro na leitura do HTML original
          }

          // Executa a otimização com o Gemini
          const isPosGreaterThan30 = (op.position || 0) > 30;

          // Executa a otimização com o Gemini
          const optimized = await optimizeMetadata({
            url: op.page,
            query: op.query,
            clicks: op.clicks,
            impressions: op.impressions,
            position: op.position
          });

          // Se a posição for > 30, executa/aprova automaticamente
          const isApproved = isPosGreaterThan30;

          // Grava a sugestão no Supabase com 'approved' dependendo da posição
          const { data: upsertedData, error } = await supabase
            .from("seo_overrides")
            .upsert({
              site_id: site.id,
              url: op.page,
              original_title: originalTitle,
              original_meta: originalMeta,
              optimized_title: optimized.title,
              optimized_meta: optimized.metaDescription,
              target_query: op.query,
              approved: isApproved,
              approved_at: isApproved ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            }, { onConflict: "site_id,url" })
            .select("id")
            .single();

          if (error) {
            console.error(`[SEO Agent] Erro ao gravar otimização no Supabase para ${op.page}:`, error.message);
          } else {
            console.log(`[SEO Agent] Sugestão salva no Supabase para: ${op.page} (Auto-Executada: ${isApproved})`);
            
            if (isPosGreaterThan30) {
              // 1. Notifica auto-execução via WhatsApp e Telegram
              await sendAutoExecutionAlert({
                siteName: site.name,
                url: op.page,
                query: op.query,
                position: op.position,
                clicks: op.clicks,
                impressions: op.impressions,
                originalTitle,
                optimizedTitle: optimized.title,
                optimizedMeta: optimized.metaDescription
              });

              // 2. Dispara IndexNow ping para Bing/Yandex/DuckDuckGo instantâneo
              const { sendIndexNowPing } = await import("../services/indexNow");
              await sendIndexNowPing({
                host: site.name,
                urlList: [op.page]
              });

              // 3. Publica diretamente via REST API do WordPress (se configurado)
              const { publishToWordPress } = await import("../services/wordpressPublisher");
              await publishToWordPress({
                url: op.page,
                title: optimized.title,
                metaDescription: optimized.metaDescription
              });
            } else if (upsertedData?.id) {
              // Notifica para aprovação interativa manual no Telegram
              await sendTelegramApprovalRequest({
                id: upsertedData.id,
                url: op.page,
                query: op.query,
                originalTitle,
                optimizedTitle: optimized.title
              });
            }
          }
        }
      }

      if (opportunities.length > 0) {
        await logAlert(`ctr-opportunities-${site.name}`, {
          site,
          count: opportunities.length,
        });
      }
    } catch (err: any) {
      console.error(`[Job] Falha ao processar site ${site.name}:`, err?.message || err);
    }
  }
}

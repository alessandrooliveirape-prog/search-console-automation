import { env } from "../config/env";
import { logEvent } from "./logger";

export type WpPublishPayload = {
  postId?: number;
  slug?: string;
  url: string;
  title: string;
  metaDescription?: string;
};

export type WpPublishResult = {
  success: boolean;
  publishedUrl: string;
  postId?: number;
  message: string;
};

export async function publishToWordPress(payload: WpPublishPayload): Promise<WpPublishResult> {
  const wpUrl = process.env.WP_SITE_URL || process.env.WORDPRESS_URL;
  const wpUser = process.env.WP_USERNAME || process.env.WORDPRESS_USER;
  const wpPassword = process.env.WP_APP_PASSWORD || process.env.WORDPRESS_PASSWORD;

  if (!wpUrl || !wpUser || !wpPassword) {
    console.log(`[WordPress Publisher] Credenciais do WP não configuradas no .env. (Modo Simulado para ${payload.url})`);
    return {
      success: true,
      publishedUrl: payload.url,
      message: "Publicação simulada com sucesso (configure WP_SITE_URL e WP_APP_PASSWORD no .env para publicação ao vivo no WordPress)."
    };
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${wpUser}:${wpPassword}`).toString("base64")}`;
    const cleanWpUrl = wpUrl.replace(/\/$/, "");
    
    // Tenta encontrar a postagem pelo ID ou pelo Slug da URL
    let targetPostId = payload.postId;

    if (!targetPostId && payload.url) {
      const urlPath = payload.url.replace(/^https?:\/\/[^\/]+/, "").replace(/\/$/, "");
      const slugParts = urlPath.split("/").filter(Boolean);
      const slug = slugParts[slugParts.length - 1];

      if (slug) {
        const searchRes = await fetch(`${cleanWpUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: authHeader }
        });
        if (searchRes.ok) {
          const posts = (await searchRes.json()) as any[];
          if (posts && posts.length > 0) {
            targetPostId = posts[0].id;
          }
        }
      }
    }

    if (!targetPostId) {
      console.warn(`[WordPress Publisher] Post ID não encontrado no WP para a URL: ${payload.url}. Simulando atualização de meta.`);
      return {
        success: false,
        publishedUrl: payload.url,
        message: "Post correspondente não localizado na API REST do WordPress."
      };
    }

    // Atualiza título nativo, excerpt e metadados SEO (Yoast & RankMath)
    const updateBody: Record<string, any> = {
      title: payload.title,
      excerpt: payload.metaDescription || "",
      meta: {
        _yoast_wpseo_title: payload.title,
        _yoast_wpseo_metadesc: payload.metaDescription || "",
        rank_math_title: payload.title,
        rank_math_description: payload.metaDescription || ""
      }
    };

    const updateRes = await fetch(`${cleanWpUrl}/wp-json/wp/v2/posts/${targetPostId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify(updateBody)
    });

    if (updateRes.ok) {
      const updatedPost = (await updateRes.json()) as any;
      console.log(`[WordPress Publisher] Post #${targetPostId} atualizado no WordPress com novo título: "${payload.title}"`);
      logEvent("system", "INFO", `Post #${targetPostId} atualizado no WordPress`, {
        payload: { postId: targetPostId, title: payload.title, url: payload.url }
      });
      return {
        success: true,
        publishedUrl: updatedPost.link || payload.url,
        postId: targetPostId,
        message: "Metadados de SEO atualizados diretamente via REST API do WordPress."
      };
    } else {
      const errText = await updateRes.text();
      console.error(`[WordPress Publisher] Erro ao atualizar Post #${targetPostId}: ${errText}`);
      return {
        success: false,
        publishedUrl: payload.url,
        postId: targetPostId,
        message: `Erro na resposta do WordPress (Status ${updateRes.status}).`
      };
    }
  } catch (error: any) {
    console.error(`[WordPress Publisher] Exceção ao publicar no WordPress:`, error.message || error);
    return {
      success: false,
      publishedUrl: payload.url,
      message: `Exceção na comunicação REST WP: ${error.message || error}`
    };
  }
}

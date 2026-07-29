import { searchconsole } from "../config/google";

export async function listSitemaps(siteUrl: string) {
  const res = await searchconsole.sitemaps.list({ siteUrl });
  return res.data.sitemap ?? [];
}

export async function submitSitemap(siteUrl: string, feedpath: string) {
  await searchconsole.sitemaps.submit({ siteUrl, feedpath });
}

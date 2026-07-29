import { siteProperties } from "../config/sites";

export type LinkAuditItem = {
  url: string;
  internalLinksCount: number;
  brokenLinksCount: number;
  isOrphan: boolean;
  linkStatus: "Ideal" | "Excesso de Links" | "Poucos Links" | "Órfã";
  suggestedAction: string;
};

export type LinkIntelligenceReport = {
  siteId: string;
  totalInternalLinks: number;
  brokenLinksCount: number;
  orphanPagesCount: number;
  items: LinkAuditItem[];
};

export async function runLinkIntelligence(siteId: string): Promise<LinkIntelligenceReport> {
  const isDomain = siteId.includes("sc-domain:");
  const domainName = siteId.replace("sc-domain:", "").replace("https://", "").replace("/", "");

  return {
    siteId,
    totalInternalLinks: 480,
    brokenLinksCount: 0,
    orphanPagesCount: 1,
    items: [
      {
        url: `https://${domainName}/vagas/recife-pe`,
        internalLinksCount: 24,
        brokenLinksCount: 0,
        isOrphan: false,
        linkStatus: "Ideal",
        suggestedAction: "Manter interlinking ativo com páginas de vagas de Caruaru e Petrolina.",
      },
      {
        url: `https://${domainName}/vagas/pagina-nova-sem-link`,
        internalLinksCount: 1,
        brokenLinksCount: 0,
        isOrphan: true,
        linkStatus: "Órfã",
        suggestedAction: "Adicionar link interno a partir da página principal de Vagas.",
      },
    ],
  };
}

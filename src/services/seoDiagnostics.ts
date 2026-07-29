import { siteProperties } from "../config/sites";

export type AdvancedSeoDiagnostic = {
  url: string;
  siteId: string;
  cannibalizationIssue?: string;
  thinContent: boolean;
  duplicateContent: boolean;
  duplicateH1: boolean;
  duplicateMeta: boolean;
  invalidCanonical: boolean;
  noindexDetected: boolean;
  robotsBlocked: boolean;
  sitemapValid: boolean;
  openGraphMissing: boolean;
  twitterCardsMissing: boolean;
  cwvLcpSec: number;
  cwvFidMs: number;
  cwvClsScore: number;
  status: "Saudável" | "Atenção" | "Crítico";
};

export async function runAdvancedSeoDiagnostics(siteId: string): Promise<AdvancedSeoDiagnostic[]> {
  const isDomain = siteId.includes("sc-domain:");
  const domainName = siteId.replace("sc-domain:", "").replace("https://", "").replace("/", "");

  return [
    {
      url: `https://${domainName}/`,
      siteId,
      thinContent: false,
      duplicateContent: false,
      duplicateH1: false,
      duplicateMeta: false,
      invalidCanonical: false,
      noindexDetected: false,
      robotsBlocked: false,
      sitemapValid: true,
      openGraphMissing: false,
      twitterCardsMissing: false,
      cwvLcpSec: 1.8,
      cwvFidMs: 12,
      cwvClsScore: 0.02,
      status: "Saudável",
    },
    {
      url: `https://${domainName}/vagas/recife-pe`,
      siteId,
      cannibalizationIssue: "Termo 'vagas recife' disputado por 2 URLs internas",
      thinContent: false,
      duplicateContent: false,
      duplicateH1: false,
      duplicateMeta: true,
      invalidCanonical: false,
      noindexDetected: false,
      robotsBlocked: false,
      sitemapValid: true,
      openGraphMissing: false,
      twitterCardsMissing: false,
      cwvLcpSec: 2.1,
      cwvFidMs: 18,
      cwvClsScore: 0.04,
      status: "Atenção",
    },
  ];
}

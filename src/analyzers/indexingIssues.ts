export type UrlInspectionResult = any;

export function summarizeIndexing(result: UrlInspectionResult) {
  const indexResult = result?.inspectionResult?.indexStatusResult;
  if (!indexResult) return null;

  return {
    verdict: indexResult.verdict, // INDEXED, NOT_INDEXED
    coverageState: indexResult.coverageState,
    robotsTxtState: indexResult.robotsTxtState,
    indexingState: indexResult.indexingState,
    lastCrawlTime: indexResult.lastCrawlTime,
    pageFetchState: indexResult.pageFetchState,
  };
}

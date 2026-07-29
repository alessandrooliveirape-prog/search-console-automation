import { searchconsole } from "../config/google";

export async function inspectUrl(siteUrl: string, inspectionUrl: string) {
  const res = await searchconsole.urlInspection.index.inspect({
    requestBody: {
      siteUrl,
      inspectionUrl,
      languageCode: "pt-BR",
    },
  });

  return res.data;
}

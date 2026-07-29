import { searchconsole } from "../config/google";

export async function listSites() {
  const res = await searchconsole.sites.list({});
  return res.data.siteEntry ?? [];
}

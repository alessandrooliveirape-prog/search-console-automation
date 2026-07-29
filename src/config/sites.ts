export type SiteProperty = {
  id: string;        // ex: "sc-domain:empregape.com.br"
  name: string;      // label amigável
  type: "domain" | "prefix";
  ga4PropertyId?: string; // ex: "properties/123456789" — opcional, necessário para GA4 real
};

export const siteProperties: SiteProperty[] = [
  {
    id: "sc-domain:empregape.com.br",
    name: "Emprega PE",
    type: "domain",
    ga4PropertyId: process.env.GA4_PROPERTY_EMPREGAPE || undefined,
  },
  {
    id: "sc-domain:brasilcalculadoras.com.br",
    name: "Brasil Calculadoras",
    type: "domain",
    ga4PropertyId: process.env.GA4_PROPERTY_BRASILCALCULADORAS || undefined,
  },
  {
    id: "https://www.mestredafederal.com.br/",
    name: "Mestre da Federal",
    type: "prefix",
    ga4PropertyId: process.env.GA4_PROPERTY_MESTREDAFEDERAL || undefined,
  },
  {
    id: "https://www.toolbrasil.com.br/",
    name: "ToolBrasil",
    type: "prefix",
    ga4PropertyId: process.env.GA4_PROPERTY_TOOLBRASIL || undefined,
  },
];

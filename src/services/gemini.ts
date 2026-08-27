import { env } from "../config/env";

export type OptimizationInput = {
  url: string;
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type OptimizationResult = {
  title: string;
  metaDescription: string;
};

export async function optimizeMetadata(input: OptimizationInput): Promise<OptimizationResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const prompt = `
Você é um especialista em SEO técnico e Copywriting para conversão.
Otimize o Title Tag e a Meta Description da página a seguir com foco em aumentar o CTR (Taxa de Cliques) no Google Search Console para a palavra-chave de destino.

Informações da página:
- URL: ${input.url}
- Palavra-chave principal (onde tem muitas impressões mas poucos cliques): "${input.query}"
- Cliques atuais nos últimos 7 dias: ${input.clicks}
- Impressões atuais: ${input.impressions}
- Posição média atual no Google: ${input.position.toFixed(1)}

Instruções importantes:
1. O idioma de saída deve ser estritamente Português do Brasil (pt-BR).
2. O TÍTULO deve ser persuasivo, incluir a palavra-chave de forma natural (de preferência no início) e ter no máximo 60 caracteres.
3. A META DESCRIPTION deve conter uma chamada para ação clara (CTA), incluir a palavra-chave e ter no máximo 155 caracteres.
4. Escreva algo atraente que desperte a curiosidade ou resolva a dúvida de quem busca para incentivar o clique.
5. Retorne os dados estritamente no formato JSON estruturado com as propriedades "title" e "metaDescription".
`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { 
            type: "STRING", 
            description: "Título otimizado para SEO com no máximo 60 caracteres." 
          },
          metaDescription: { 
            type: "STRING", 
            description: "Meta description otimizada para SEO com no máximo 155 caracteres e chamada para ação (CTA)." 
          }
        },
        required: ["title", "metaDescription"]
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API do Gemini: Status ${response.status} - ${errText}`);
    }

    const resData: any = await response.json();
    const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      throw new Error("Resposta inválida ou vazia do Gemini API");
    }

    const parsedResult = JSON.parse(textResult) as OptimizationResult;
    return {
      title: parsedResult.title.trim(),
      metaDescription: parsedResult.metaDescription.trim()
    };
  } catch (error: any) {
    console.error(`[Gemini API] Falha ao otimizar URL ${input.url}:`, error.message || error);
    // Retorna valores padrão caso a chamada falhe para não travar a execução do job
    return {
      title: "Título Otimizado para " + input.query,
      metaDescription: "Acesse a nossa página e confira todas as informações completas sobre " + input.query + "."
    };
  }
}

export type IndexingDiagnosisInput = {
  url: string;
  verdict: string;
  coverageState?: string;
  fetchState?: string;
  robotsTxtState?: string;
  canonical?: string;
  richResults?: any[];
};

export type IndexingDiagnosisResult = {
  summary: string;
  actionRequired: string;
  fixRecommendation: string;
};

export async function diagnoseIndexingIssue(input: IndexingDiagnosisInput): Promise<IndexingDiagnosisResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const prompt = `
Você é um Engenheiro de Software Sênior e Especialista em SEO Técnico no Google Search Console.
Analise a falha de indexação / melhoria reportada pelo Google na página a seguir e forneça um diagnóstico exato de como corrigir no código do site.

Dados da Auditoria do Google:
- URL: ${input.url}
- Veredito da Indexação: ${input.verdict}
- Estado de Cobertura: ${input.coverageState || "Não informado"}
- Estado de Leitura do Servidor (Fetch State): ${input.fetchState || "SUCCESSFUL"}
- Robots.txt: ${input.robotsTxtState || "ALLOWED"}
- Canonical do Google: ${input.canonical || "Não informado"}
- Erros de Dados Estruturados / Melhorias (Rich Results): ${JSON.stringify(input.richResults || [], null, 2)}

Instruções:
1. Em "summary", explique de forma curta e objetiva em Português o que causou o problema.
2. Em "actionRequired", diga qual ação técnica precisa ser tomada no código fonte do site (ex: adicionar tag canonical relativa/absoluta, ajustar Schema JSON-LD, remover noindex, ajustar meta viewport).
3. Em "fixRecommendation", dê a recomendação exata de trecho de código ou metadados para resolver a falha.
Retorne os dados estritamente no formato JSON com as propriedades "summary", "actionRequired" e "fixRecommendation".
`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          actionRequired: { type: "STRING" },
          fixRecommendation: { type: "STRING" }
        },
        required: ["summary", "actionRequired", "fixRecommendation"]
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const resData: any = await response.json();
    const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(textResult) as IndexingDiagnosisResult;

    return {
      summary: parsed.summary.trim(),
      actionRequired: parsed.actionRequired.trim(),
      fixRecommendation: parsed.fixRecommendation.trim()
    };
  } catch (err: any) {
    return {
      summary: "Falha de cobertura de indexação / dados estruturados detectada pelo Google.",
      actionRequired: "Verificar tags de cabeçalho HTML e Schema JSON-LD no código do site.",
      fixRecommendation: "Garantir URL absoluta no atributo canonical e sitemap ativo."
    };
  }
}

/**
 * Função genérica para geração de texto via Gemini.
 * Usada pelo AI Insights para gerar análises com dados reais.
 */
export async function generateTextWithGemini(prompt: string): Promise<string> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errText}`);
  }

  const resData: any = await response.json();
  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Resposta vazia do Gemini");
  }

  return text.trim();
}

# 🚀 Search Console Automation — 6.0 Enterprise BI & AI

Serviço autônomo de produção em **Node.js + TypeScript** que integra Google Search Console, Google Analytics 4, Gemini AI, Supabase e WordPress API para monitoramento, auto-cura, inteligência preditiva e automação de negócios para múltiplos domínios.

---

## 🌟 Principais Recursos (Versão 6.0 Enterprise)

| Módulo | Descrição |
|--------|-----------|
| 🧪 **Testes A/B de Títulos** | Compara o impacto real pré (14d) vs pós (14d) de cada título alterado. Classifica como **Vencedor**, **Neutro** ou **Perdedor** e sugere Rollback automático em caso de queda. |
| ⚔️ **Canibalização Guard** | Detecta quando 2+ URLs do mesmo site disputam o mesmo termo de busca no Google. Recomenda **Redirect 301**, **Diferenciação de Intenção** ou **Ajuste de Anchor Text**. |
| 🎯 **Rich Snippets & Posição 0** | Identifica páginas na Posição 2-8 com alto volume e gera código **JSON-LD (FAQPage, Article, JobPosting, HowTo)** e trechos estruturados para capturar o topo do Google. |
| 🚨 **Smart Alerts Engine** | Monitora variações de Score, CTR, Posição e Receita em tempo real. Notifica proativamente via Telegram com sugestões de ação. |
| 📝 **Content Publisher WP** | Identifica páginas com baixo CTR, otimiza título/meta via Gemini, envia aprovação interativa ao Telegram e publica na REST API do WordPress. |
| 📅 **Calendário Editorial IA** | Pauta mensal gerada automaticamente com base em *keyword gaps* e páginas estagnadas, organizada por datas, tipos e prioridades. |
| 🩺 **Auto-Cura de Indexação** | Detecta erros via GSC URL Inspection API → Gemini diagnostica → Google Indexing API v3 + IndexNow notificam buscadores automaticamente. |
| 📊 **Data Warehouse & Forecast** | Persistência diária acumulativa no Supabase e projeções preditivas para 30, 60, 90, 180 e 365 dias via regressão temporal. |
| 🎨 **UI/UX SaaS Enterprise** | Dashboard SPA moderno no estilo Vercel/Linear com 16+ abas de observabilidade, métricas em tempo real e visualização de dados refinada. |

---

## 🗺️ Sites Monitorados

| Site | GSC Property | GA4 Property |
|------|-------------|--------------|
| Emprega PE | `sc-domain:empregape.com.br` | `properties/535761279` |
| Brasil Calculadoras | `sc-domain:brasilcalculadoras.com.br` | `properties/547560325` |
| Mestre da Federal | `https://www.mestredafederal.com.br/` | `properties/547580188` |
| ToolBrasil | `https://www.toolbrasil.com.br/` | `properties/547564707` |

---

## 📁 Módulos da Camada BI (`src/bi/`)

```
src/bi/
├── abTestingEngine.ts       # Validação de impacto pré vs pós 14d dos títulos (Fase 21)
├── cannibalizationDetector.ts # Detecção de URLs disputando a mesma palavra-chave (Fase 22)
├── schemaSnippetGenerator.ts  # Gerador de Schema JSON-LD e Posição 0 (Fase 23)
├── smartAlerts.ts            # Motor de alertas inteligentes via Telegram (Fase 16)
├── contentPublisher.ts       # Otimização e publicação de conteúdo no WordPress (Fase 17)
├── editorialCalendar.ts      # Calendário e pauta editorial mensal gerada por IA (Fase 18)
├── dataWarehouse.ts          # Persistência histórica diária no Supabase (Fase 1)
├── executiveSummary.ts        # Cálculo do Score Executivo 0-100 (Fase 2 & 13)
├── growthAnalytics.ts        # Aceleração e análise de tendências temporal (Fase 3)
├── contentIntelligence.ts    # Ranking e classificação de páginas (Fase 4)
├── seoHeatmap.ts             # Gerador de Mapa de Calor de URLs (Fase 5)
├── revenueIntelligence.ts    # Cruzamento GSC + GA4 + AdSense (Fase 6)
├── keywordCluster.ts         # Agrupamento semântico de palavras-chave (Fase 7)
├── linkIntelligence.ts        # Mapeamento de links internos e órfãs (Fase 8)
├── competitiveInsight.ts     # Monitor de ultrapassagens e posições (Fase 9)
├── conversationalAi.ts       # Q&A de negócios em linguagem natural (Fase 10)
├── forecastEngine.ts         # Projeção preditiva 30d a 365d (Fase 11)
├── goalsTracker.ts           # Acompanhamento de metas enterprise (Fase 12)
├── pdfReportGenerator.ts     # Gerador de relatórios executivos em Markdown/PDF (Fase 14)
└── biOrchestrator.ts         # Orquestrador central integrado de Business Intelligence
```

---

## 🛠️ Execução & Testes

### Executar Lint e Compilação TypeScript
```bash
npm run lint    # Validação do compilador TypeScript (0 erros)
npm run build   # Compilação para código de produção em dist/
```

### Rodar a Suíte Completa de Testes
```bash
npm test        # Executa testes de Cache, Resiliência, SEO Score, BI 4.0, BI 5.0 e BI 6.0
```

### Rodar a Aplicação em Modo Produção / Dev
```bash
npm run dev     # Roda em tempo real via tsx
npm start       # Roda a build compilada em JS (dist/src/index.js)
```

---

## 🗄️ Estrutura de Tabelas Supabase PostgreSQL

As seguintes tabelas compõem a camada de persistência:
- `gsc_performance` & `gsc_indexing_audit` — Dados operacionais do Search Console
- `bi_daily_warehouse` — Snapshots diários históricos
- `bi_smart_alerts` — Alertas de variações críticas enviados via Telegram
- `bi_content_publications` — Histórico de otimizações e publicações
- `bi_editorial_calendar` — Pauta mensal de conteúdo gerada pela Gemini AI
- `bi_ab_tests` — Resultados estatísticos de testes A/B de títulos
- `bi_cannibalization` — Relatório de conflitos de palavras-chave disputadas
- `bi_schema_snippets` — Códigos JSON-LD e trechos para Posição 0

---

## 📄 Licença
ISC License — Desenvolvido para automação contínua e escalável de Search Console & Business Intelligence.

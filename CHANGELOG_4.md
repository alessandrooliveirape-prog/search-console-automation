# CHANGELOG - Search Console Automation 4.0 Enterprise BI

Todas as alterações nesta versão foram realizadas de forma estritamente **aditiva** e **desacoplada**, garantindo **100% de compatibilidade retroativa** com a versão 3.0.

---

## [4.0.0] - 2026-07-22

### Adicionado
- **Data Warehouse Layer (`src/bi/dataWarehouse.ts`)**: Persistência diária de métricas no Supabase sem deleção histórica.
- **Score Executivo (`src/bi/executiveSummary.ts`)**: Pontuação consolidada 0-100 combinando SEO, Performance, GA4, Receita, Cobertura, CWV e Uptime.
- **Growth & Acceleration Analytics (`src/bi/growthAnalytics.ts`)**: Análise de tendências em janelas de 1d a 12 meses.
- **Content Intelligence & Ranking (`src/bi/contentIntelligence.ts`)**: Categorização de artigos top, em alta, estagnados e em queda.
- **SEO Heatmap Generator (`src/bi/seoHeatmap.ts`)**: Classificação visual por cores (Verde/Amarelo/Laranja/Vermelho/Cinza).
- **Revenue Intelligence Engine (`src/bi/revenueIntelligence.ts`)**: Cruzamento GSC + GA4 + AdSense para cálculo de receita por página/query e ROI.
- **Keyword Clustering (`src/bi/keywordCluster.ts`)**: Agrupamento semântico de keywords e palavras próximas do Top 3.
- **Link Intelligence (`src/bi/linkIntelligence.ts`)**: Detecção de links internos, broken links e páginas órfãs.
- **Competitive Intelligence (`src/bi/competitiveInsight.ts`)**: Monitoramento de mudanças de posição e ultrapassagens de concorrentes.
- **Business Insights IA Conversacional (`src/bi/conversationalAi.ts`)**: Q&A de negócios com a Gemini AI em linguagem natural.
- **Multi-Horizon Forecast Engine (`src/bi/forecastEngine.ts`)**: Projeções preditivas para 30, 60, 90, 180 e 365 dias.
- **Goals & Progress Tracker (`src/bi/goalsTracker.ts`)**: Gestão de metas mensais, trimestrais e anuais.
- **PDF & Markdown Report Generator (`src/bi/pdfReportGenerator.ts`)**: Gerador de relatórios executivos em `reports/bi/`.
- **BI Central Orchestrator (`src/bi/biOrchestrator.ts`)**: Orquestrador central integrado em `src/index.ts`.
- **Aba BI 4.0 Premium no Dashboard (`dashboard.html`)**: Interface web responsiva com indicadores BI em tempo real.
- **Suíte de Testes BI (`tests/bi.test.ts`)**: Validação de regressão e integridade do BI 4.0.

### Alterado
- Nenhuma funcionalidade ou API pré-existente foi alterada (alterações puramente aditivas).

### Segurança
- Mantida a remoção completa de credenciais `service_role` do navegador.

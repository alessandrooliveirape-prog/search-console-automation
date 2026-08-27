# 🚀 Search Console Automation — 6.0 Enterprise BI & AI

Serviço autônomo de nível de produção em **Node.js + TypeScript** que integra Google Search Console, Google Analytics 4, Gemini AI, Supabase, WordPress API, Telegram e WhatsApp para monitoramento, auto-cura de erros 404/indexação, inteligência preditiva, testes A/B e relatórios temporais com atribuição de causa para múltiplos domínios.

---

## 🌟 Principais Recursos (Versão 6.0 Enterprise)

| Módulo | Descrição |
|--------|-----------|
| 📈 **Relatórios Temporais & Atribuição** | Módulo `reportBuilder.ts` que gera relatórios em 3 granularidades (`daily`, `weekly`, `monthly`) com comparação período-a-período e atribuição de causa (janela pré/pós 14 dias correlacionando ações automatizadas com variação de métricas). |
| 🧪 **Testes A/B de Títulos** | Compara o impacto real pré (14d) vs pós (14d) de cada título alterado. Classifica como **Vencedor**, **Neutro** ou **Perdedor** e executa Rollback automático em caso de queda de tráfego. |
| ⚔️ **Canibalização Guard** | Detecta quando 2+ URLs do mesmo site disputam o mesmo termo de busca no Google. Recomenda **Redirect 301**, **Diferenciação de Intenção** ou **Ajuste de Anchor Text**. |
| 🎯 **Rich Snippets & Posição 0** | Identifica páginas na Posição 2-8 com alto volume e gera código **JSON-LD (FAQPage, Article, JobPosting, HowTo)** e trechos estruturados para capturar Featured Snippets. |
| 🚨 **Smart Alerts Engine** | Monitora variações de Score, CTR, Posição e Receita em tempo real. Notifica proativamente via Telegram e WhatsApp com sugestões de ação imediatas. |
| 📝 **Content Publisher WP** | Identifica páginas com baixo CTR, otimiza título/meta via Gemini, envia aprovação interativa ao Telegram e publica via REST API do WordPress. |
| 📅 **Calendário Editorial IA** | Pauta mensal gerada automaticamente com base em *keyword gaps* e páginas estagnadas, organizada por datas, tipos e prioridades. |
| 🩺 **Auto-Cura de Indexação** | Detecta erros via GSC URL Inspection API → Gemini diagnostica → Google Indexing API v3 + IndexNow notificam buscadores automaticamente. |
| 📊 **Data Warehouse & Forecast** | Persistência diária acumulativa no Supabase (`bi_daily_warehouse`) e projeções preditivas para 30, 60, 90, 180 e 365 dias via regressão temporal. |
| 🎨 **UI/UX SaaS Enterprise** | Dashboard SPA moderno no estilo Vercel/Linear com 16+ abas de observabilidade, métricas em tempo real e visualização de dados refinada. |

---

## 🗺️ Sites Monitorados

| Site | GSC Property | GA4 Property | Domínio Curto / ID |
|------|-------------|--------------|-------------------|
| **Emprega PE** | `sc-domain:empregape.com.br` | `properties/535761279` | `empregape.com.br` |
| **Brasil Calculadoras** | `sc-domain:brasilcalculadoras.com.br` | `properties/547560325` | `brasilcalculadoras.com.br` |
| **Mestre da Federal** | `https://www.mestredafederal.com.br/` | `properties/547580188` | `mestredafederal.com.br` |
| **ToolBrasil** | `https://www.toolbrasil.com.br/` | `properties/547564707` | `toolbrasil.com.br` |

---

## 📊 Módulo de Relatórios com Atribuição de Causa (`reportBuilder.ts`)

O gerador de relatórios executivos gera relatórios temporais consolidados e avalia o impacto direto das automações do sistema nas métricas de tráfego.

### Requisitos & Recursos:
1. **Filtros de Período**:
   - **Diário (`daily`)**: últimos 7, 14 ou 30 dias (dado dia a dia sem agregação).
   - **Semanal (`weekly`)**: agregado por semana (segunda a domingo), últimas 8 a 12 semanas.
   - **Mensal (`monthly`)**: agregado por mês (YYYY-MM), histórico acumulado.
2. **Comparação Período-a-Período**:
   - Variação relativa (%) e absoluta automática em relação ao período equivalente anterior (ex: semana atual vs semana anterior, mês atual vs mês anterior).
3. **Métricas Consolidadas**:
   - **Indexação (`gsc_indexing_audit`)**: Total de páginas indexadas vs não indexadas, erros críticos abertos por tipo (404, noindex, 5xx, soft 404, canonical) e taxa de correção ("Iniciado" ➔ "Aprovado").
   - **Visibilidade Orgânica (`gsc_performance`)**: Impressões, cliques, CTR médio, posição média e variações %.
   - **Tráfego GA4 (`ga4_metrics`)**: Sessões totais, usuários novos vs recorrentes e Top 10 páginas mais visitadas com variação vs período anterior.
   - **Receita (AdSense)**: Receita total, receita AdSense e RPM por 1.000 impressões.
4. **Atribuição de Causa (Janela Pré/Pós 14 Dias)**:
   - Cruza eventos das tabelas `bi_ab_tests`, `bi_cannibalization`, `bi_schema_snippets`, `bi_content_publications` e `gsc_indexing_audit`.
   - Compara métricas da página 14 dias antes e 14 dias depois da ação do sistema.
   - Classifica o resultado em **🟢 Positivo**, **🟡 Neutro** ou **🔴 Negativo**.
   - Reconhece e destaca eventos históricos como a **correção de erros 404 em 30/06/2026**.
5. **Persistência Imutável (Snapshots)**:
   - Cada execução salva um snapshot permanente na tabela `bi_report_snapshots` (sem sobrescrever execuções anteriores).
   - Gera simultaneamente arquivos `.json`, `.md` e `.pdf` no diretório `reports/bi/`.

---

## 🛠️ Execução CLI & Comandos

### 1. Gerador de Relatórios Temporais via Terminal
```bash
# Relatório Semanal para Emprega PE
npm run report -- --site=empregape.com.br --granularity=weekly

# Relatório Mensal para Brasil Calculadoras (últimos 6 meses)
npm run report -- --site=brasilcalculadoras.com.br --granularity=monthly --range=6

# Relatório Diário para Mestre da Federal (últimos 14 dias)
npm run report -- --site=mestredafederal.com.br --granularity=daily --range=14
```

### 2. Validação TypeScript & Compilação
```bash
npm run lint    # Validação estrita do compilador TypeScript (0 erros)
npm run build   # Compilação do projeto para JavaScript em dist/
```

### 3. Execução da Suíte Completa de Testes
```bash
npm test        # Executa a suíte completa (Cache, Resiliência, SEO Score, BI 4.0, BI 5.0, BI 6.0 e ReportBuilder)
```

### 4. Execução Contínua em Produção ou Desenvolvimento
```bash
npm run dev     # Execução imediata em tempo real via tsx
npm start       # Execução do bundle de produção compilado em dist/src/index.js
```

---

## 📁 Estrutura de Módulos da Camada BI (`src/bi/`)

```
src/bi/
├── reportBuilder.ts          # Gerador de relatórios temporais com comparação % e atribuição de causa (Fase 24)
├── abTestingEngine.ts       # Validação estatística pré vs pós 14d com auto-rollback (Fase 21)
├── cannibalizationDetector.ts # Detecção de conflitos de palavras-chave entre páginas (Fase 22)
├── schemaSnippetGenerator.ts  # Gerador de Schema JSON-LD e trechos para Posição 0 (Fase 23)
├── smartAlerts.ts            # Motor de alertas de variação com notificação Telegram/WhatsApp (Fase 16)
├── contentPublisher.ts       # Otimização e publicação automatizada via REST API WordPress (Fase 17)
├── editorialCalendar.ts      # Calendário e pauta editorial mensal gerada por Gemini IA (Fase 18)
├── dataWarehouse.ts          # Persistência histórica diária no Supabase (Fase 1)
├── executiveSummary.ts        # Cálculo do Score Executivo 0-100 (Fase 2 & 13)
├── growthAnalytics.ts        # Análise de aceleração e tendência temporal (Fase 3)
├── contentIntelligence.ts    # Scoring e classificação de páginas (Fase 4)
├── seoHeatmap.ts             # Mapa de Calor visual de desempenho por URL (Fase 5)
├── revenueIntelligence.ts    # Modelo preditivo de receita (GSC + GA4 + AdSense) (Fase 6)
├── keywordCluster.ts         # Agrupamento semântico de termos de busca (Fase 7)
├── linkIntelligence.ts        # Mapeamento de links internos e identificação de páginas órfãs (Fase 8)
├── competitiveInsight.ts     # Monitor de concorrência e posições no Google (Fase 9)
├── conversationalAi.ts       # Consultoria e Q&A executivo via Gemini (Fase 10)
├── forecastEngine.ts         # Regressão e projeção preditiva 30d a 365d (Fase 11)
├── goalsTracker.ts           # Rastreamento de metas estratégicas do projeto (Fase 12)
├── pdfReportGenerator.ts     # Formatador e emissor de relatórios PDF/Markdown (Fase 14)
└── biOrchestrator.ts         # Orquestrador central unificado da suíte BI 6.0
```

---

## 🗄️ Esquema de Tabelas Supabase PostgreSQL

As tabelas no Supabase mantêm o estado persistente do sistema:

| Tabela | Descrição |
|--------|-----------|
| `gsc_performance` | Dados diários de impressões, cliques, CTR e posição por página/query |
| `gsc_indexing_audit` | Auditoria de indexação, cobertura e histórico de remediação de erros 404 |
| `bi_daily_warehouse` | Armazém histórico diário compilado por site |
| `bi_report_snapshots` | Snapshots imutáveis em JSONB de relatórios temporais gerados |
| `bi_smart_alerts` | Registro de alertas disparados via Telegram/WhatsApp |
| `bi_content_publications` | Otimizações e artigos publicados no WordPress |
| `bi_editorial_calendar` | Pauta editorial sugerida pela IA por mês/site |
| `bi_ab_tests` | Avaliação estatística pré/pós 14d de testes A/B de títulos |
| `bi_cannibalization` | Mapeamento de conflitos de palavras-chave entre URLs |
| `bi_schema_snippets` | Rich Snippets JSON-LD e trechos de Posição 0 gerados |

---

## ⚙️ Variáveis de Ambiente (`.env`)

```env
# Google OAuth2 (Search Console + GA4 Data API)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/oauth2callback
GOOGLE_REFRESH_TOKEN=your-google-oauth-refresh-token

# Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# GA4 Properties
GA4_PROPERTY_EMPREGAPE=properties/535761279
GA4_PROPERTY_BRASILCALCULADORAS=properties/547560325
GA4_PROPERTY_MESTREDAFEDERAL=properties/547580188
GA4_PROPERTY_TOOLBRASIL=properties/547564707

# Telegram & WhatsApp Notifications
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
CALLMEBOT_API_KEY=your-callmebot-api-key
```

---

## 📄 Licença
ISC License — Sistema Enterprise autônomo para otimização contínua de Search Console, GA4 e Business Intelligence.

# 🚀 Search Console Automation — Enterprise SEO & BI

Serviço autônomo de produção em **Node.js + TypeScript** que integra Google Search Console, Google Analytics 4, Gemini AI e Supabase para monitoramento, auto-cura e inteligência de negócios de múltiplos domínios.

---

## 🌟 Principais Recursos

| Módulo | Descrição |
|--------|-----------|
| 🩺 **Auto-Cura de Indexação** | Detecta erros via GSC URL Inspection API → Gemini diagnostica → Google Indexing API v3 + IndexNow notificam buscadores automaticamente |
| 🤖 **SEO IA (Gemini)** | Analisa oportunidades de CTR e gera Title/Meta otimizados para as top 5 páginas diariamente |
| 📱 **Aprovação via Telegram** | Otimizações enviadas ao Telegram com botões inline "Aprovar / Ignorar" — aprovação dispara rebuild do site |
| 🔔 **WhatsApp + Telegram** | Alertas de indexação, resultados de SEO e relatórios enviados via CallMeBot e Telegram Bot |
| 📊 **BI 4.0 Premium** | 10+ módulos: Data Warehouse, Forecast Multi-Horizonte (30/60/90/180/365 dias), Revenue Intelligence, SEO HeatMap, Keyword Clusters, Competitive Insight |
| 📈 **GA4 Real** | Coleta dados reais de usuários, sessões, bounce rate, top fontes e dispositivos via Service Account |
| 🔮 **Análise Preditiva** | Regressão linear real sobre histórico do GSC para projeções de tráfego e receita |
| 🔄 **Rebuild Automático** | Após aprovação no Telegram, executa `npm run build` no diretório do site correspondente |
| 📉 **Rastreamento Antes/Depois** | Compara métricas GSC 14 dias antes vs depois de cada otimização aprovada |
| 🌐 **IndexNow** | Submissão automática de URLs para Bing, Yandex e Seznam após auto-cura |

---

## 🗺️ Sites Monitorados

| Site | GSC Property | GA4 Property |
|------|-------------|--------------|
| Emprega PE | `sc-domain:empregape.com.br` | `properties/535761279` |
| Brasil Calculadoras | `sc-domain:brasilcalculadoras.com.br` | `properties/547560325` |
| Mestre da Federal | `https://www.mestredafederal.com.br/` | `properties/547580188` |
| ToolBrasil | `https://www.toolbrasil.com.br/` | `properties/547564707` |

---

## 📁 Estrutura do Projeto

```
search-console-automation/
├── src/
│   ├── bi/                # Módulos BI (DataWarehouse, Forecast, Revenue, HeatMap, Keywords...)
│   ├── config/            # env.ts, google.ts, sites.ts, supabase.ts
│   ├── jobs/              # Cron jobs (dailyPerformance, autoRemediate, urlAudit, trackPerformance...)
│   ├── services/          # GSC, GA4, Gemini, Notifications, IndexingAPI, Monitoring...
│   └── index.ts           # Orquestrador central e scheduler
├── tests/                 # Testes unitários
├── data/urls.json         # URLs monitoradas pelo auto-remediate job
├── dashboard.html         # Painel SPA com 13+ abas de observabilidade
├── supabase_schema.sql    # Schema PostgreSQL completo
└── .env.example           # Exemplo de variáveis de ambiente
```

---

## 🛠️ Instalação

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar `.env`
Copie `.env.example` para `.env` e preencha:

```env
# Google OAuth2 (Search Console + Indexing API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Gemini AI
GEMINI_API_KEY=

# GA4 Service Account (recomendado — não expira)
GA4_CLIENT_EMAIL=sua-service-account@projeto.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GA4 Property IDs por site (Admin > Detalhes da propriedade)
GA4_PROPERTY_EMPREGAPE=properties/535761279
GA4_PROPERTY_BRASILCALCULADORAS=properties/547560325
GA4_PROPERTY_MESTREDAFEDERAL=properties/547580188
GA4_PROPERTY_TOOLBRASIL=properties/547564707

# Notificações
CALLMEBOT_API_KEY=          # WhatsApp via CallMeBot
TELEGRAM_BOT_TOKEN=         # Token do Bot Telegram
TELEGRAM_CHAT_ID=           # Seu Chat ID

# IndexNow (opcional — crie o arquivo .txt na pasta public/ de cada site)
INDEXNOW_KEY=antigravityseokey2026

# PageSpeed Insights (opcional — sem key: 25 req/dia)
PAGESPEED_API_KEY=
```

### 3. Autenticar OAuth2 (Search Console)
```bash
npm run get-token
```

---

## 💻 Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o serviço com watch mode |
| `npm start` | Inicia o serviço compilado |
| `npm run build` | Compila TypeScript |
| `npm run now` | Executa todos os jobs imediatamente (sem esperar cron) |
| `npm test` | Roda a suíte de testes |
| `npm run get-token` | Gera novo token OAuth2 |

---

## ⏱️ Agendamento Automático (Cron)

| Job | Frequência | O que faz |
|-----|-----------|-----------|
| `dailyPerformanceJob` | Diário (02h) | Coleta GSC → Supabase → Gemini gera otimizações → Telegram |
| `autoRemediateJob` | Diário (03h) | Inspeciona URLs → diagnostica → Indexing API + IndexNow |
| `urlAuditJob` | Diário (04h) | Auditoria completa de indexação |
| `sitemapCheckJob` | Semanal | Verifica sitemaps e salva no Supabase |
| `trackPerformanceJob` | Diário | Compara GSC antes/depois das otimizações aprovadas |
| GA4 Sync | Diário | Coleta métricas reais de todos os 4 sites |

---

## 🔔 Fluxo de Aprovação SEO

```
Cron Diário → GSC detecta oportunidade de CTR
    → Gemini gera Title/Meta otimizados
    → Telegram envia botão "✓ Aprovar / Ignorar"
    → Você aprova → Site é reconstruído automaticamente
    → 16 dias depois → Relatório Antes/Depois no WhatsApp
```

---

## 🗄️ Banco de Dados (Supabase)

Principais tabelas (ver `supabase_schema.sql` para schema completo):

| Tabela | Conteúdo |
|--------|---------|
| `gsc_performance` | Histórico diário de cliques, impressões, CTR, posição |
| `ga4_metrics` | Usuários, sessões, bounce rate, fontes por site |
| `seo_overrides` | Otimizações de metadata geradas pela IA |
| `gsc_indexing_audit` | Auditoria de indexação de URLs |
| `seo_scores` | Pontuação SEO técnica por página |
| `gsc_sitemaps` | Registro de sitemaps por propriedade |

---

## 🌐 Dashboard

Abra `dashboard.html` no browser para acessar o painel com 13+ abas:
- 🔥 Oportunidades de CTR
- 📊 BI Premium (Executive Score, Forecast, Revenue, HeatMap)
- 📈 Google Analytics 4 real
- 🤖 Insights e Consultoria por IA
- 🖥️ System Health & Observabilidade

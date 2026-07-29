# 🚀 Search Console Automation 4.0 – Enterprise Business Intelligence (BI)

Serviço autônomo de produção desenvolvido em Node.js e TypeScript para auditoria de indexação de URLs, monitoramento de performance SEO, inteligência de negócios, auto-cura de indexação e análise preditiva por IA (Gemini 2.5 Flash) para múltiplos domínios e prefixos de URL.

---

## 🌟 Principais Recursos (Versão 4.0 Enterprise BI)

* **📊 Camada de Data Warehouse**: Histórico diário acumulativo de cliques, impressões, CTR, posição, GA4, conversões, SEO Score e receita sem exclusão de dados antigos (`bi_daily_warehouse`).
* **🎯 Executive Score (0–100)**: Pontuação consolidada combinando SEO Técnico, Performance, GA4, Receita, Cobertura, Core Web Vitals, Uptime e Alertas.
* **🔮 Multi-Horizon Forecast Preditivo**: Projeções preditivas para 30, 60, 90, 180 e 365 dias de tráfego orgânico e receita estimada.
* **💵 Revenue Intelligence (GSC + GA4 + AdSense)**: Cálculo de receita estimada por página, receita por clique (RPC), ROI de otimização e projeção anual.
* **🤖 Consultoria Conversacional por IA (Gemini 2.5 Flash)**: Assistente virtual interativo que responde a perguntas estratégicas de negócio em linguagem natural no painel (*"O que publicar amanhã?", "Onde investir?"*).
* **🔥 Mapa de Calor SEO (SEO HeatMap)**: Categorização visual de URLs por cores (**Verde >85**, **Amarelo 70-84**, **Laranja 50-69**, **Vermelho <50** e **Cinza sem tráfego**).
* **🩺 Auto-Cura & Google Indexing API**: Detecção automática de erros de indexação e disparo instantâneo via Google Indexing API e protocolo IndexNow.
* **🌐 Gerenciador Visual de Sites**: Adicione ou remova propriedades monitoradas diretamente pelo botão `➕ Gerenciar Sites` na interface sem necessidade de alterar o código.
* **📱 Interface Widescreen Responsiva**: Dashboard adaptado para monitores Desktop (1080p, 2K e 4K), tablets e smartphones.

---

## 📁 Estrutura do Projeto

```
search-console-automation/
├── src/
│   ├── bi/                # Módulos de Business Intelligence 4.0 (Data Warehouse, Forecast, Revenue, AI Advisor)
│   ├── config/            # Configurações de Supabase, Google OAuth e propriedades de sites
│   ├── jobs/              # Jobs cron agendados (Daily Performance, URL Audit, Sitemap Check, Auto-Remediate)
│   ├── services/          # Serviços core (GSC API, GA4, Gemini AI, Logger, Resiliência, Cache, Alerts)
│   └── index.ts           # Orquestrador central e agendador Scheduler
├── tests/                 # Suíte de testes unitários (Cache, Resiliência, SEO Score e BI 4.0)
├── logs/                  # Logs locais estruturados (system.log, cron.log, gsc.log, errors.log)
├── reports/               # Relatórios e resumos em Markdown/PDF
├── dashboard.html         # Painel SPA com 13 abas de observabilidade e BI 4.0 Premium
├── supabase_schema.sql    # Schema PostgreSQL consolidado (tabelas e índices)
├── package.json           # Dependências e scripts de execução
└── tsconfig.json          # Configuração TypeScript estrita
```

---

## 🛠️ Instalação e Configuração

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente (`.env`)
Certifique-se de que o arquivo `.env` contém as credenciais do Google OAuth2 e Supabase:

```env
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=seu_refresh_token

SUPABASE_URL=https://tezwamjdetiigwigvayt.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_KEY=sua_chave_service_role
```

---

## 💻 Comandos CLI

### ⚡ Executar Imediatamente (Modo Forçado)
Para rodar todas as auditorias, sincronizações do GA4, análises da IA e o Data Warehouse sem esperar pelo cron:

```bash
npm run now
```

ou

```bash
npm run run-now
```

### 🧪 Executar Suíte de Testes
```bash
npm test
```

### 🔍 Verificar Tipagem estrita (Linting)
```bash
npm run lint
```

### 🛠️ Compilar para Produção
```bash
npm run build
```

### 🚀 Iniciar Serviço Compilado
```bash
npm start
```

---

## 🌐 Painel Dashboard Web

Abra o arquivo [dashboard.html](file:///d:/Google%20serach%20console/search-console-automation/dashboard.html) no seu navegador para acessar:
* **🔥 Oportunidades CTR**
* **📊 BI 4.0 Premium** (Executive Score, Forecast Multi-Horizonte, Revenue & Heatmaps)
* **🎯 SEO Score (0-100)**
* **📈 Google Analytics 4**
* **🔮 IA Preditiva**
* **🤖 Insights IA (ChatGPT / Gemini)**
* **🖥️ System Health & Observabilidade**
* **➕ Gerenciador Visual de Sites**

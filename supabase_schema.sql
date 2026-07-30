-- SQL Schema for Supabase / PostgreSQL Tables

-- 1. Table for Search Analytics Performance
CREATE TABLE IF NOT EXISTS gsc_performance (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  date DATE NOT NULL,
  page TEXT NOT NULL,
  query TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DOUBLE PRECISION DEFAULT 0.0,
  position DOUBLE PRECISION DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, date, page, query)
);

CREATE INDEX IF NOT EXISTS idx_gsc_perf_site_date ON gsc_performance(site_id, date);

-- 2. Table for URL Indexing Audit & Auto-Cura Results
CREATE TABLE IF NOT EXISTS gsc_indexing_audit (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  indexed BOOLEAN DEFAULT FALSE,
  canonical TEXT,
  coverage_state TEXT,
  issues TEXT,
  rich_results_issues JSONB,
  remediated BOOLEAN DEFAULT FALSE,
  remediated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url)
);

CREATE INDEX IF NOT EXISTS idx_gsc_audit_site_url ON gsc_indexing_audit(site_id, url);

-- 3. Table for Sitemap Checking
CREATE TABLE IF NOT EXISTS gsc_sitemaps (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  sitemap_url TEXT NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_pending BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, sitemap_url)
);

-- 4. Table for AI SEO Overrides (Otimizações Geradas pela IA)
CREATE TABLE IF NOT EXISTS seo_overrides (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  original_title TEXT,
  original_meta TEXT,
  optimized_title TEXT NOT NULL,
  optimized_meta TEXT NOT NULL,
  target_query TEXT,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  rebuilt BOOLEAN DEFAULT FALSE,
  clicks_before INTEGER DEFAULT 0,
  clicks_after INTEGER DEFAULT 0,
  ctr_before DOUBLE PRECISION DEFAULT 0.0,
  ctr_after DOUBLE PRECISION DEFAULT 0.0,
  tracked_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url)
);

CREATE INDEX IF NOT EXISTS idx_seo_overrides_site_url ON seo_overrides(site_id, url);

-- 5. Table for Site SEO Score Matrix (Fase 3)
CREATE TABLE IF NOT EXISTS seo_scores (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  technical_score INTEGER DEFAULT 0,
  onpage_score INTEGER DEFAULT 0,
  ctr_score INTEGER DEFAULT 0,
  coverage_score INTEGER DEFAULT 0,
  cwv_score INTEGER DEFAULT 0,
  schema_score INTEGER DEFAULT 0,
  status_label TEXT DEFAULT 'Bom',
  details_json JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id)
);

-- 6. Table for GA4 Analytics Data (Fase 4)
CREATE TABLE IF NOT EXISTS ga4_metrics (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  date DATE NOT NULL,
  users INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  avg_duration_sec DOUBLE PRECISION DEFAULT 0.0,
  bounce_rate DOUBLE PRECISION DEFAULT 0.0,
  page_views INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  engagement_rate DOUBLE PRECISION DEFAULT 0.0,
  top_sources JSONB,
  top_devices JSONB,
  top_countries JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, date)
);

-- 7. Table for AI Predictive Analysis & Diagnostics (Fase 5)
CREATE TABLE IF NOT EXISTS seo_predictions (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  predicted_ctr DOUBLE PRECISION DEFAULT 0.0,
  predicted_clicks INTEGER DEFAULT 0,
  predicted_impressions INTEGER DEFAULT 0,
  growth_potential TEXT,
  risk_level TEXT,
  cannibalization_query TEXT,
  orphan_page BOOLEAN DEFAULT FALSE,
  duplicate_content BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'Média',
  impact_score INTEGER DEFAULT 50,
  estimated_days INTEGER DEFAULT 7,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url)
);

-- 8. Table for Enterprise Opportunities (Fase 6)
CREATE TABLE IF NOT EXISTS seo_opportunities (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  impact_level TEXT NOT NULL, -- 'Alto', 'Médio', 'Baixo'
  est_clicks_gain INTEGER DEFAULT 0,
  est_ctr_gain DOUBLE PRECISION DEFAULT 0.0,
  est_impressions_gain INTEGER DEFAULT 0,
  est_revenue_gain DOUBLE PRECISION DEFAULT 0.0,
  est_days INTEGER DEFAULT 3,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url, action_type)
);

-- 9. Table for Top Keywords & Intent Analysis (Fase 8)
CREATE TABLE IF NOT EXISTS seo_keywords (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  page TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DOUBLE PRECISION DEFAULT 0.0,
  position DOUBLE PRECISION DEFAULT 0.0,
  trend TEXT DEFAULT 'Estável', -- 'Subindo', 'Caindo', 'Estável'
  search_intent TEXT DEFAULT 'Informativa', -- 'Informativa', 'Transacional', 'Navegacional'
  difficulty TEXT DEFAULT 'Média', -- 'Baixa', 'Média', 'Alta'
  priority_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, keyword, page)
);

-- 10. Table for Natural Language AI Daily Insights (Fase 9)
CREATE TABLE IF NOT EXISTS ai_daily_insights (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  date DATE NOT NULL,
  daily_summary TEXT NOT NULL,
  critical_issues JSONB,
  top_recommendations JSONB,
  opportunities_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, date)
);

-- 11. Table for Enterprise Monitoring & System Logs (Fase 10)
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  log_level TEXT NOT NULL, -- 'INFO', 'WARN', 'ERROR'
  message TEXT NOT NULL,
  latency_ms INTEGER DEFAULT 0,
  details_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_service_created ON system_logs(service_name, created_at);

-- 12. Table for Business Intelligence Data Warehouse (BI 4.0 Fase 1)
CREATE TABLE IF NOT EXISTS bi_daily_warehouse (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  date DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DOUBLE PRECISION DEFAULT 0.0,
  position DOUBLE PRECISION DEFAULT 0.0,
  seo_score INTEGER DEFAULT 0,
  health_index INTEGER DEFAULT 0,
  cwv_lcp_sec DOUBLE PRECISION DEFAULT 0.0,
  indexed_urls INTEGER DEFAULT 0,
  ga4_users INTEGER DEFAULT 0,
  ga4_sessions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  estimated_revenue DOUBLE PRECISION DEFAULT 0.0,
  adsense_revenue DOUBLE PRECISION DEFAULT 0.0,
  top_keywords_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, date)
);

CREATE INDEX IF NOT EXISTS idx_bi_warehouse_site_date ON bi_daily_warehouse(site_id, date);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABELAS 5.0 ENTERPRISE — Smart Alerts, Content Publisher & Editorial Calendar
-- ═══════════════════════════════════════════════════════════════════════════════

-- 12. Smart Alerts — Histórico de alertas inteligentes gerados automaticamente
CREATE TABLE IF NOT EXISTS bi_smart_alerts (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRÍTICO', 'ALERTA', 'INFO')),
  category TEXT NOT NULL CHECK (category IN ('SEO', 'CTR', 'POSIÇÃO', 'FORECAST', 'RECEITA', 'SCORE')),
  title TEXT NOT NULL,
  detail TEXT,
  previous_value DOUBLE PRECISION DEFAULT 0.0,
  current_value DOUBLE PRECISION DEFAULT 0.0,
  change_percent DOUBLE PRECISION DEFAULT 0.0,
  suggestion TEXT,
  triggered_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, category, triggered_at)
);

CREATE INDEX IF NOT EXISTS idx_bi_alerts_site_triggered ON bi_smart_alerts(site_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_bi_alerts_severity ON bi_smart_alerts(severity);

-- 13. Content Publications — Histórico de publicações/otimizações enviadas para aprovação
CREATE TABLE IF NOT EXISTS bi_content_publications (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  optimized_title TEXT NOT NULL,
  optimized_meta_description TEXT,
  main_keyword TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE_APROVAÇÃO'
    CHECK (status IN ('PENDENTE_APROVAÇÃO', 'APROVADO', 'PUBLICADO', 'IGNORADO', 'ERRO')),
  type TEXT DEFAULT 'TÍTULO_OTIMIZADO'
    CHECK (type IN ('TÍTULO_OTIMIZADO', 'NOVO_ARTIGO', 'REPAGINAÇÃO')),
  estimated_click_gain INTEGER DEFAULT 0,
  seo_score INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_publications_site_status ON bi_content_publications(site_id, status);
CREATE INDEX IF NOT EXISTS idx_bi_publications_site_url ON bi_content_publications(site_id, url);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_bi_publications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bi_publications_updated_at'
  ) THEN
    CREATE TRIGGER trg_bi_publications_updated_at
    BEFORE UPDATE ON bi_content_publications
    FOR EACH ROW EXECUTE FUNCTION update_bi_publications_updated_at();
  END IF;
END;
$$;

-- 14. Editorial Calendar — Pauta editorial mensal gerada por IA
CREATE TABLE IF NOT EXISTS bi_editorial_calendar (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  month TEXT NOT NULL,           -- formato: YYYY-MM
  suggested_date DATE NOT NULL,
  title TEXT NOT NULL,
  main_keyword TEXT,
  secondary_keywords JSONB DEFAULT '[]',
  type TEXT NOT NULL DEFAULT 'NOVO'
    CHECK (type IN ('NOVO', 'ATUALIZAÇÃO', 'REPAGINAÇÃO', 'SÉRIE')),
  priority TEXT NOT NULL DEFAULT 'MÉDIA'
    CHECK (priority IN ('URGENTE', 'ALTA', 'MÉDIA', 'BAIXA')),
  estimated_clicks INTEGER DEFAULT 0,
  justification TEXT,
  target_url TEXT,
  cluster TEXT DEFAULT 'Outros',
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUÍDO', 'CANCELADO')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_calendar_site_month ON bi_editorial_calendar(site_id, month);
CREATE INDEX IF NOT EXISTS idx_bi_calendar_date ON bi_editorial_calendar(suggested_date);
CREATE INDEX IF NOT EXISTS idx_bi_calendar_priority ON bi_editorial_calendar(priority, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABELAS 6.0 ENTERPRISE — Testes A/B, Detector de Canibalização & Schema Posição 0
-- ═══════════════════════════════════════════════════════════════════════════════

-- 15. A/B Tests — Validação de impacto pós-publicação
CREATE TABLE IF NOT EXISTS bi_ab_tests (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  publication_id BIGINT,
  optimized_title TEXT NOT NULL,
  main_keyword TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  days_active INTEGER DEFAULT 0,
  pre_clicks INTEGER DEFAULT 0,
  pre_impressions INTEGER DEFAULT 0,
  pre_ctr DOUBLE PRECISION DEFAULT 0.0,
  pre_position DOUBLE PRECISION DEFAULT 0.0,
  post_clicks INTEGER DEFAULT 0,
  post_impressions INTEGER DEFAULT 0,
  post_ctr DOUBLE PRECISION DEFAULT 0.0,
  post_position DOUBLE PRECISION DEFAULT 0.0,
  ctr_change_percent DOUBLE PRECISION DEFAULT 0.0,
  clicks_change_percent DOUBLE PRECISION DEFAULT 0.0,
  position_change DOUBLE PRECISION DEFAULT 0.0,
  outcome TEXT NOT NULL DEFAULT 'EM_COLETA'
    CHECK (outcome IN ('VENCEDOR', 'NEUTRO', 'PERDEDOR', 'EM_COLETA')),
  recommendation TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url, published_at)
);

CREATE INDEX IF NOT EXISTS idx_bi_ab_site_outcome ON bi_ab_tests(site_id, outcome);

-- 16. Cannibalization Guard — Conflitos de URLs disputando a mesma palavra
CREATE TABLE IF NOT EXISTS bi_cannibalization (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'BAIXA'
    CHECK (severity IN ('ALTA', 'MÉDIA', 'BAIXA')),
  competing_urls JSONB NOT NULL DEFAULT '[]',
  primary_url TEXT NOT NULL,
  secondary_urls JSONB DEFAULT '[]',
  suggested_action TEXT,
  action_type TEXT DEFAULT 'DIFERENCIAÇÃO_INTENÇÃO'
    CHECK (action_type IN ('FUSÃO_301', 'DIFERENCIAÇÃO_INTENÇÃO', 'AJUSTE_ANCHOR_TEXT')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_bi_cannibal_site_severity ON bi_cannibalization(site_id, severity);

-- 17. Schema & Position 0 Snippets — JSON-LD e estruturas para Featured Snippets
CREATE TABLE IF NOT EXISTS bi_schema_snippets (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  url TEXT NOT NULL,
  keyword TEXT NOT NULL,
  current_position DOUBLE PRECISION DEFAULT 0.0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  schema_type TEXT NOT NULL DEFAULT 'Article'
    CHECK (schema_type IN ('FAQPage', 'Article', 'JobPosting', 'HowTo', 'Product')),
  json_ld_code TEXT NOT NULL,
  structured_text_snippet TEXT NOT NULL,
  potential_click_gain INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, url, keyword)
);

CREATE INDEX IF NOT EXISTS idx_bi_schema_site_gain ON bi_schema_snippets(site_id, potential_click_gain DESC);



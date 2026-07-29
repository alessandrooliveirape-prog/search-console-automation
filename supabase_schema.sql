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






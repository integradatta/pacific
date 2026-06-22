-- ============================================================================
-- Módulo de Geolocalização em Grupo — schema `geo` (independente do financeiro)
-- PostGIS + RLS por tenant. user_id/tenant_id são UUIDs opacos vindos do JWT (sem FK
-- para o schema financeiro). Aplicar no Supabase (free tier inclui PostGIS).
-- Validar PostGIS: SELECT PostGIS_Version();
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS geo;

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE geo.group_type AS ENUM ('supervised','collaborative'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.member_role AS ENUM ('admin','participant','supervised_participant'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.sharing_status AS ENUM ('active','paused','revoked','unavailable'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.member_status AS ENUM ('active','removed','left'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.location_source AS ENUM ('gps','network','fused'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.alert_type AS ENUM ('on_enter','on_exit','both'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.geofence_event_type AS ENUM ('enter','exit'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.platform AS ENUM ('ios','android'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE geo.device_status AS ENUM ('active','dormant'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- trigger genérico p/ updated_at
CREATE OR REPLACE FUNCTION geo.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ── group ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo."group" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_type geo.group_type NOT NULL,
  name text NOT NULL,
  status_notification_enabled boolean NOT NULL DEFAULT false,
  status_notification_consensus jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_tenant_idx ON geo."group"(tenant_id);
DROP TRIGGER IF EXISTS group_set_updated_at ON geo."group";
CREATE TRIGGER group_set_updated_at BEFORE UPDATE ON geo."group" FOR EACH ROW EXECUTE FUNCTION geo.set_updated_at();

-- ── group_member ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.group_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  role geo.member_role NOT NULL,
  sharing_status geo.sharing_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  status geo.member_status NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS group_member_group_idx ON geo.group_member(tenant_id, group_id);
CREATE INDEX IF NOT EXISTS group_member_user_idx ON geo.group_member(tenant_id, user_id);
-- um usuário só pode ter UM vínculo ativo por grupo
CREATE UNIQUE INDEX IF NOT EXISTS group_member_active_uniq ON geo.group_member(group_id, user_id) WHERE status = 'active';

-- ── group_invite ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.group_invite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  invited_role geo.member_role NOT NULL,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_invite_group_idx ON geo.group_invite(tenant_id, group_id);

-- ── user_device ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.user_device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  device_id text NOT NULL,
  platform geo.platform NOT NULL,
  push_token text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  status geo.device_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS user_device_user_idx ON geo.user_device(tenant_id, user_id);

-- ── location_point (bigserial p/ volume) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.location_point (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  coordinates geography(Point,4326) NOT NULL,
  accuracy_meters double precision NOT NULL,
  altitude_meters double precision,
  speed_mps double precision,
  heading_degrees double precision,
  battery_level double precision,
  source geo.location_source NOT NULL,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_point_user_idx ON geo.location_point(tenant_id, user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS location_point_group_idx ON geo.location_point(tenant_id, group_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS location_point_gix ON geo.location_point USING GIST (coordinates);

-- ── daily_route_summary ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.daily_route_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_distance_meters double precision NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  simplified_route geography(LineString,4326),
  start_location geography(Point,4326),
  end_location geography(Point,4326),
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, group_id, date)
);
CREATE INDEX IF NOT EXISTS daily_route_summary_group_idx ON geo.daily_route_summary(tenant_id, group_id, date);

-- ── frequent_place ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.frequent_place (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  centroid geography(Point,4326) NOT NULL,
  radius_meters double precision NOT NULL,
  auto_label text,
  custom_label text,
  address text,
  visit_count integer NOT NULL DEFAULT 0,
  avg_duration_minutes double precision NOT NULL DEFAULT 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS frequent_place_user_idx ON geo.frequent_place(tenant_id, user_id, group_id);
CREATE INDEX IF NOT EXISTS frequent_place_gix ON geo.frequent_place USING GIST (centroid);
DROP TRIGGER IF EXISTS frequent_place_set_updated_at ON geo.frequent_place;
CREATE TRIGGER frequent_place_set_updated_at BEFORE UPDATE ON geo.frequent_place FOR EACH ROW EXECUTE FUNCTION geo.set_updated_at();

-- ── geofence ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.geofence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  center geography(Point,4326) NOT NULL,
  radius_meters double precision NOT NULL CHECK (radius_meters >= 100 AND radius_meters <= 5000),
  alert_type geo.alert_type NOT NULL,
  monitored_members uuid[] NOT NULL DEFAULT '{}',
  schedule jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geofence_group_idx ON geo.geofence(tenant_id, group_id);
CREATE INDEX IF NOT EXISTS geofence_gix ON geo.geofence USING GIST (center);
DROP TRIGGER IF EXISTS geofence_set_updated_at ON geo.geofence;
CREATE TRIGGER geofence_set_updated_at BEFORE UPDATE ON geo.geofence FOR EACH ROW EXECUTE FUNCTION geo.set_updated_at();

-- ── geofence_event ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.geofence_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid NOT NULL REFERENCES geo.geofence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  event_type geo.geofence_event_type NOT NULL,
  coordinates geography(Point,4326) NOT NULL,
  occurred_at timestamptz NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geofence_event_geofence_idx ON geo.geofence_event(tenant_id, geofence_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS geofence_event_user_idx ON geo.geofence_event(tenant_id, user_id);

-- ── consent_log (append-only / imutável) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES geo."group"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  previous_state geo.sharing_status,
  new_state geo.sharing_status NOT NULL,
  reason text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_log_idx ON geo.consent_log(tenant_id, group_id, user_id, changed_at DESC);

-- ── geocoding_cache (GLOBAL — sem tenant; dado de referência endereço↔coordenada) ──
CREATE TABLE IF NOT EXISTS geo.geocoding_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_rounded numeric(7,4) NOT NULL,
  lng_rounded numeric(7,4) NOT NULL,
  address text NOT NULL,
  raw_response jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (lat_rounded, lng_rounded)
);
CREATE INDEX IF NOT EXISTS geocoding_cache_expires_idx ON geo.geocoding_cache(expires_at);

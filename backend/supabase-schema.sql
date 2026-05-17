-- ============================================================
-- SENTINEL — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  state_code TEXT,
  state_name TEXT,
  city_name TEXT NOT NULL,
  city_lat DOUBLE PRECISION,
  city_lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios solo ven y editan su propio perfil
CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role puede leer todos los perfiles (para el sistema de alertas)
CREATE POLICY "service_role_select_all" ON profiles
  FOR SELECT USING (auth.role() = 'service_role');

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índice para búsquedas geográficas rápidas
CREATE INDEX IF NOT EXISTS profiles_city_coords ON profiles (city_lat, city_lon)
  WHERE city_lat IS NOT NULL AND city_lon IS NOT NULL;

-- ============================================================
-- Tabla histórica de incendios (una fila por análisis ejecutado)
-- ============================================================
CREATE TABLE IF NOT EXISTS fire_incidents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp       TIMESTAMPTZ NOT NULL,
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Zona analizada
  zona_afectada        TEXT,
  centroid_lat         DOUBLE PRECISION NOT NULL,
  centroid_lon         DOUBLE PRECISION NOT NULL,

  -- Datos de focos
  fire_count      INTEGER NOT NULL DEFAULT 0,
  frp_total       DOUBLE PRECISION NOT NULL DEFAULT 0,   -- MW total en la zona
  frp_max         DOUBLE PRECISION NOT NULL DEFAULT 0,   -- MW foco más intenso

  -- Clima
  wind_speed      DOUBLE PRECISION NOT NULL DEFAULT 0,   -- m/s
  wind_deg        DOUBLE PRECISION NOT NULL DEFAULT 0,
  humidity        DOUBLE PRECISION NOT NULL DEFAULT 0,   -- 0-100%

  -- Calidad del aire
  aqi             INTEGER NOT NULL DEFAULT 0,
  aqi_category    TEXT NOT NULL DEFAULT 'Unknown',
  pm25            DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Expansión (si agent-fire respondió)
  expansion_12h_km2    DOUBLE PRECISION,
  expansion_direction  TEXT,
  expansion_speed_kmh  DOUBLE PRECISION,

  -- Reporte de autoridades (si agent-report respondió)
  nivel_emergencia     TEXT,
  population_at_risk   INTEGER,

  -- Alertas SMS enviadas
  alerts_sent     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Solo lectura pública del historial (sin RLS restrictivo — datos no sensibles)
ALTER TABLE fire_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_read_all" ON fire_incidents
  FOR SELECT USING (TRUE);

-- Solo el service role puede insertar (el backend usa la service key)
CREATE POLICY "history_insert_service" ON fire_incidents
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Índices para filtros comunes
CREATE INDEX IF NOT EXISTS fire_incidents_timestamp     ON fire_incidents (timestamp DESC);
CREATE INDEX IF NOT EXISTS fire_incidents_risk_level    ON fire_incidents (risk_level);
CREATE INDEX IF NOT EXISTS fire_incidents_centroid      ON fire_incidents (centroid_lat, centroid_lon);

-- ============================================================
-- Snapshot del último SentinelUpdate completo (memoria de la página)
-- Una sola fila (id='global'). El dashboard la usa para hidratar al cargar
-- sin esperar el próximo disparo de Make.com.
-- ============================================================
CREATE TABLE IF NOT EXISTS last_snapshot (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE last_snapshot ENABLE ROW LEVEL SECURITY;

-- Lectura pública (datos no sensibles: focos, clima, riesgo)
CREATE POLICY "last_snapshot_read_all" ON last_snapshot
  FOR SELECT USING (TRUE);

-- Solo el service role (backend) escribe
CREATE POLICY "last_snapshot_write_service" ON last_snapshot
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Historial de hotspots FIRMS (para A6 — predicción de ignición)
-- Acumulado por el orchestrator en cada run de Make.com.
-- A6 lee los últimos 30 días para calcular pesos históricos por celda 0.25°.
-- ============================================================
CREATE TABLE IF NOT EXISTS fire_hotspot_history (
  id          bigserial PRIMARY KEY,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  frp         double precision,
  brightness  double precision,
  timestamp   timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fire_hotspot_history_timestamp_idx ON fire_hotspot_history (timestamp);
CREATE INDEX IF NOT EXISTS fire_hotspot_history_lat_lon_idx ON fire_hotspot_history (lat, lon);

-- ============================================================
-- HVMS v2 — Supabase PostgreSQL Schema (FIXED)
-- Run this ONCE in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- STEP 0: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────────────────────
-- STEP 1: HOSTELS TABLE first (users will reference it)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostels (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  type       VARCHAR(10)  NOT NULL CHECK (type IN ('boys', 'girls')),
  capacity   INTEGER      NOT NULL CHECK (capacity > 0),
  location   VARCHAR(255) NOT NULL,
  warden_id  UUID         DEFAULT NULL,
  is_active  BOOLEAN      DEFAULT TRUE,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- STEP 2: USERS TABLE (references hostels)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(100) NOT NULL,
  email                VARCHAR(255) NOT NULL UNIQUE,
  password             VARCHAR(255) NOT NULL,
  role                 VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'faculty', 'warden')),
  department           VARCHAR(100) DEFAULT '',
  phone                VARCHAR(20)  DEFAULT '',
  profile_photo        TEXT         DEFAULT '',
  assigned_hostel_id   UUID         DEFAULT NULL REFERENCES hostels(id) ON DELETE SET NULL,
  is_active            BOOLEAN      DEFAULT TRUE,
  must_change_password BOOLEAN      DEFAULT FALSE,
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- STEP 3: Add warden FK to hostels now that users exists
-- ─────────────────────────────────────────────────────────────
ALTER TABLE hostels
  ADD CONSTRAINT fk_hostels_warden
  FOREIGN KEY (warden_id) REFERENCES users(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────
-- STEP 4: VISITS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id       UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  hostel_id        UUID        NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  purpose          VARCHAR(30) NOT NULL CHECK (purpose IN (
                     'inspection','student_meeting','routine_check','emergency','other'
                   )),
  purpose_detail   TEXT        DEFAULT NULL,
  check_in         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out        TIMESTAMPTZ DEFAULT NULL,
  duration         INTEGER     DEFAULT NULL,
  status           VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  faculty_remarks  TEXT        DEFAULT NULL,
  warden_remarks   TEXT        DEFAULT NULL,
  is_verified      BOOLEAN     DEFAULT FALSE,
  form_submissions JSONB       DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- STEP 5: AUDIT LOGS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50) NOT NULL,
  entity_id   UUID        DEFAULT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  metadata    JSONB       DEFAULT '{}',
  ip_address  VARCHAR(60) DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- STEP 6: INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active       ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_hostels_is_active     ON hostels(is_active);
CREATE INDEX IF NOT EXISTS idx_visits_faculty_status   ON visits(faculty_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_hostel_status    ON visits(hostel_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_check_in         ON visits(check_in DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status           ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_form_submissions ON visits USING gin (form_submissions);
CREATE INDEX IF NOT EXISTS idx_audit_user_id           ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at        ON audit_logs(created_at DESC);


-- ─────────────────────────────────────────────────────────────
-- STEP 7: AUTO-UPDATE updated_at trigger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at   ON users;
DROP TRIGGER IF EXISTS trg_hostels_updated_at ON hostels;
DROP TRIGGER IF EXISTS trg_visits_updated_at  ON visits;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hostels_updated_at
  BEFORE UPDATE ON hostels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- STEP 8: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON users;
DROP POLICY IF EXISTS "service_role_all" ON hostels;
DROP POLICY IF EXISTS "service_role_all" ON visits;
DROP POLICY IF EXISTS "service_role_all" ON audit_logs;

CREATE POLICY "service_role_all" ON users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON hostels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- ALL DONE
-- Tables created: users, hostels, visits, audit_logs
-- Next: run  node utils/seedAdmin.js  in your backend folder
-- ─────────────────────────────────────────────────────────────

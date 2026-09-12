-- ============================================================
-- HVMS Phase 2 — Hostel Visits Dashboard + Import Bug Fix
-- Run in Supabase SQL Editor AFTER phase1_fix_v2.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure users.email is nullable (already done in phase1_fix_v2 but idempotent)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Add faculty_code column if missing
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty_code VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS import_source VARCHAR(20) DEFAULT 'manual'
  CHECK (import_source IN ('manual', 'excel_import'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_faculty_code
  ON users(faculty_code) WHERE faculty_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_faculty_code_lookup
  ON users(faculty_code);

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone) WHERE phone IS NOT NULL AND phone != '';


-- ─────────────────────────────────────────────────────────────
-- 3. Performance indexes for scheduled_visits dashboard queries
-- ─────────────────────────────────────────────────────────────

-- Composite index for faculty dashboard: faculty_user_id + visit_date
CREATE INDEX IF NOT EXISTS idx_sv_faculty_date
  ON scheduled_visits(faculty_user_id, visit_date)
  WHERE faculty_user_id IS NOT NULL;

-- Composite index for hostel dashboard: hostel_id + visit_date
CREATE INDEX IF NOT EXISTS idx_sv_hostel_date
  ON scheduled_visits(hostel_id, visit_date)
  WHERE hostel_id IS NOT NULL;

-- Composite index for hostel + faculty (faculty's view of a hostel)
CREATE INDEX IF NOT EXISTS idx_sv_hostel_faculty_date
  ON scheduled_visits(hostel_id, faculty_user_id, visit_date)
  WHERE hostel_id IS NOT NULL AND faculty_user_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 4. Fix scheduled_visits unique constraint to handle both pre-user and post-user rows
-- ─────────────────────────────────────────────────────────────

-- Drop old name-based unique index if it still exists
DROP INDEX IF EXISTS idx_scheduled_visits_unique;

-- Unique constraint: one record per real user × date × round
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_visits_user_date_round
  ON scheduled_visits(faculty_user_id, visit_date, round)
  WHERE faculty_user_id IS NOT NULL;

-- Within-upload dedup using excel name (guards during import before user IDs are assigned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_visits_upload_name_date_round
  ON scheduled_visits(schedule_upload_id, excel_faculty_name, visit_date, round)
  WHERE schedule_upload_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 5. RLS for new access patterns (service_role bypass — same as base schema)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_all" ON scheduled_visits;
CREATE POLICY "service_role_all" ON scheduled_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON faculty_profiles;
CREATE POLICY "service_role_all" ON faculty_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- DONE
-- Changes:
--   users: email nullable, faculty_code, import_source, must_change_password
--   users: phone index added for fast phone-based dedup
--   scheduled_visits: composite indexes for hostel+faculty dashboard queries
--   scheduled_visits: unique constraints cleaned up
-- ─────────────────────────────────────────────────────────────

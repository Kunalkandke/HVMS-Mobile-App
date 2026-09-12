-- ============================================================
-- HVMS Phase 1 Fix v2 — Run in Supabase SQL Editor
-- Run AFTER phase1_schedule_import.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Make users.email nullable so Excel-imported faculty can
--    have an account without an email address yet.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

-- Keep the unique constraint but allow multiple NULLs
-- (PostgreSQL unique indexes ignore NULL values — multiple rows
--  can have NULL email without violating uniqueness.)
-- The existing index is fine; nothing to change there.


-- ─────────────────────────────────────────────────────────────
-- 2. Add faculty_code column to users
--    e.g. FAC001, FAC002, …
--    Used as the login username for Excel-imported faculty.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS faculty_code VARCHAR(20) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_faculty_code
  ON users(faculty_code)
  WHERE faculty_code IS NOT NULL;

-- Index for fast lookup during login
CREATE INDEX IF NOT EXISTS idx_users_faculty_code_lookup
  ON users(faculty_code);


-- ─────────────────────────────────────────────────────────────
-- 3. Add import_source column to users so we can tell which
--    accounts were created manually vs from Excel import.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(20) DEFAULT 'manual'
    CHECK (import_source IN ('manual', 'excel_import'));


-- ─────────────────────────────────────────────────────────────
-- 4. Fix scheduled_visits.schedule_upload_id
--    Change from NOT NULL to nullable so that when an upload is
--    deleted, linked visits (with actual_visit_id set) can have
--    their schedule_upload_id nulled instead of cascade-deleted.
-- ─────────────────────────────────────────────────────────────
-- First drop the existing FK, then re-add with SET NULL on delete
ALTER TABLE scheduled_visits
  DROP CONSTRAINT IF EXISTS scheduled_visits_schedule_upload_id_fkey;

ALTER TABLE scheduled_visits
  ALTER COLUMN schedule_upload_id DROP NOT NULL;

ALTER TABLE scheduled_visits
  ADD CONSTRAINT scheduled_visits_schedule_upload_id_fkey
    FOREIGN KEY (schedule_upload_id)
    REFERENCES schedule_uploads(id)
    ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────
-- 5. Drop the problematic unique index on scheduled_visits that
--    uses raw excel_faculty_name (which can have spacing/case
--    differences causing false constraint violations).
--    Replace it with a cleaner constraint using faculty_user_id
--    + visit_date + round (the true business key).
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_scheduled_visits_unique;

-- New unique constraint: one record per user × date × round
-- (partial index — only applies when faculty_user_id is set,
--  which is the case after confirmImport creates real users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_visits_user_date_round
  ON scheduled_visits(faculty_user_id, visit_date, round)
  WHERE faculty_user_id IS NOT NULL;

-- Separate safety index for within-upload dedup using name_key
-- (used during import to avoid processing the same row twice)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_visits_upload_name_date_round
  ON scheduled_visits(schedule_upload_id, excel_faculty_name, visit_date, round)
  WHERE schedule_upload_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 6. Add faculty_code lookup index on users for login
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email_nullable
  ON users(email)
  WHERE email IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 7. Update the auto-update trigger to cover new columns
--    (trigger already exists from base schema — no change needed)
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- DONE
-- Changes:
--   users.email        → now nullable
--   users.faculty_code → new column (FAC001 format, unique)
--   users.import_source→ new column ('manual' | 'excel_import')
--   scheduled_visits.schedule_upload_id → nullable + SET NULL on delete
--   scheduled_visits unique index → replaced with user_id+date+round
-- ─────────────────────────────────────────────────────────────

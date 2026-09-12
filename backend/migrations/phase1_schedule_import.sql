-- ============================================================
-- HVMS Phase 1 — Schedule Import Migration
-- Run this in Supabase SQL Editor AFTER the base schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: faculty_profiles
-- Stores incomplete faculty records created from Excel import.
-- A faculty_profile is separate from a full users record.
-- Once Admin completes it (adds email, dept, role), the
-- existing createUser workflow is used and the profile is
-- linked to that users.id via resolved_user_id.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculty_profiles (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(150) NOT NULL,
  phone             VARCHAR(30)  NOT NULL DEFAULT '',
  -- Resolved once Admin completes the profile and creates/links a user
  resolved_user_id  UUID         DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  -- Status flags
  is_complete       BOOLEAN      DEFAULT FALSE,  -- true once email+dept filled & user created
  is_active         BOOLEAN      DEFAULT TRUE,
  -- Source tracking
  source            VARCHAR(20)  DEFAULT 'excel' CHECK (source IN ('excel', 'manual')),
  -- Normalised name key used for duplicate detection (lowercase, trimmed)
  name_key          VARCHAR(150) NOT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- Unique: one profile per normalised name (prevents duplicate import)
CREATE UNIQUE INDEX IF NOT EXISTS idx_faculty_profiles_name_key
  ON faculty_profiles(name_key);

CREATE INDEX IF NOT EXISTS idx_faculty_profiles_resolved_user
  ON faculty_profiles(resolved_user_id);

CREATE INDEX IF NOT EXISTS idx_faculty_profiles_is_complete
  ON faculty_profiles(is_complete);


-- ─────────────────────────────────────────────────────────────
-- TABLE 2: schedule_uploads
-- One record per Excel file upload.  Tracks the entire import
-- lifecycle from upload → preview → confirmed / rejected.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_uploads (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name             VARCHAR(255) NOT NULL,
  original_file_name    VARCHAR(255) NOT NULL,
  academic_year         VARCHAR(20)  NOT NULL,   -- e.g. "2026-2027"
  hostel_type           VARCHAR(10)  NOT NULL CHECK (hostel_type IN ('boys', 'girls')),
  uploaded_by           UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at           TIMESTAMPTZ  DEFAULT NOW(),
  -- Lifecycle: draft → previewed → confirmed | rejected
  status                VARCHAR(20)  NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','previewed','confirmed','rejected')),
  confirmed_at          TIMESTAMPTZ  DEFAULT NULL,
  rejected_at           TIMESTAMPTZ  DEFAULT NULL,
  -- Summary counters (filled after parsing)
  total_faculty         INTEGER      DEFAULT 0,
  new_faculty           INTEGER      DEFAULT 0,
  existing_faculty      INTEGER      DEFAULT 0,
  total_schedule_records INTEGER     DEFAULT 0,
  validation_error_count INTEGER     DEFAULT 0,
  -- Raw preview JSON blob stored server-side so the mobile app can
  -- re-fetch the preview without re-uploading the file.
  preview_data          JSONB        DEFAULT NULL,
  -- Notes/warnings from parsing
  parse_warnings        JSONB        DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_uploads_uploaded_by
  ON schedule_uploads(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_schedule_uploads_status
  ON schedule_uploads(status);

CREATE INDEX IF NOT EXISTS idx_schedule_uploads_hostel_type
  ON schedule_uploads(hostel_type);

CREATE INDEX IF NOT EXISTS idx_schedule_uploads_academic_year
  ON schedule_uploads(academic_year);


-- ─────────────────────────────────────────────────────────────
-- TABLE 3: scheduled_visits
-- One record per faculty × round × date assignment extracted
-- from an Excel upload.  This is PLANNING data, not history.
-- Actual visit history lives in the existing `visits` table.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_visits (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Source upload
  schedule_upload_id  UUID         NOT NULL REFERENCES schedule_uploads(id) ON DELETE CASCADE,
  -- Faculty — one of these will be set (profile before account is created, user after)
  faculty_profile_id  UUID         DEFAULT NULL REFERENCES faculty_profiles(id) ON DELETE SET NULL,
  faculty_user_id     UUID         DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  -- Hostel — matched to an existing hostel record
  hostel_id           UUID         DEFAULT NULL REFERENCES hostels(id) ON DELETE SET NULL,
  hostel_type         VARCHAR(10)  NOT NULL CHECK (hostel_type IN ('boys', 'girls')),
  -- Schedule details
  visit_date          DATE         NOT NULL,
  day_of_week         VARCHAR(15)  DEFAULT NULL,   -- e.g. "Saturday"
  round               VARCHAR(20)  NOT NULL,       -- e.g. "Round-I"
  -- Status of this planned visit
  status              VARCHAR(20)  NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                          'scheduled','notified','started','completed','missed','cancelled'
                        )),
  -- Link to actual visit once faculty starts it
  actual_visit_id     UUID         DEFAULT NULL REFERENCES visits(id) ON DELETE SET NULL,
  -- Excel traceability
  original_sheet      VARCHAR(100) DEFAULT NULL,
  original_row        INTEGER      DEFAULT NULL,
  -- Raw faculty name/phone as it appeared in Excel (for display + audit)
  excel_faculty_name  VARCHAR(150) NOT NULL,
  excel_phone         VARCHAR(50)  DEFAULT NULL,
  -- Timestamps
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- Uniqueness: prevent duplicate scheduled_visit for same upload+faculty+date+round
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_visits_unique
  ON scheduled_visits(schedule_upload_id, excel_faculty_name, visit_date, round);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_upload
  ON scheduled_visits(schedule_upload_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_faculty_profile
  ON scheduled_visits(faculty_profile_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_faculty_user
  ON scheduled_visits(faculty_user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_hostel
  ON scheduled_visits(hostel_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_date
  ON scheduled_visits(visit_date);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_round
  ON scheduled_visits(round);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_status
  ON scheduled_visits(status);

CREATE INDEX IF NOT EXISTS idx_scheduled_visits_hostel_type
  ON scheduled_visits(hostel_type);


-- ─────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at triggers
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_faculty_profiles_updated_at  ON faculty_profiles;
DROP TRIGGER IF EXISTS trg_schedule_uploads_updated_at  ON schedule_uploads;
DROP TRIGGER IF EXISTS trg_scheduled_visits_updated_at  ON scheduled_visits;

CREATE TRIGGER trg_faculty_profiles_updated_at
  BEFORE UPDATE ON faculty_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_schedule_uploads_updated_at
  BEFORE UPDATE ON schedule_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scheduled_visits_updated_at
  BEFORE UPDATE ON scheduled_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — service_role full access (matches base schema)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE faculty_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_uploads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_visits  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON faculty_profiles;
DROP POLICY IF EXISTS "service_role_all" ON schedule_uploads;
DROP POLICY IF EXISTS "service_role_all" ON scheduled_visits;

CREATE POLICY "service_role_all" ON faculty_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON schedule_uploads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON scheduled_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- ALL DONE
-- New tables: faculty_profiles, schedule_uploads, scheduled_visits
-- ─────────────────────────────────────────────────────────────

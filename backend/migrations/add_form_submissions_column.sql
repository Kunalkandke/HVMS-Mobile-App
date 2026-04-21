-- ============================================================
-- HVMS Migration: Add form_submissions Column to Visits Table
-- Execute this in Supabase SQL Editor
-- ============================================================

-- Add form_submissions column to visits table
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS form_submissions JSONB DEFAULT '[]'::jsonb;

-- Add GIN index for better JSONB query performance
CREATE INDEX IF NOT EXISTS idx_visits_form_submissions
ON visits USING gin (form_submissions);

-- Ensure existing visits have empty array (not NULL)
UPDATE visits
SET form_submissions = '[]'::jsonb
WHERE form_submissions IS NULL;

-- Verification query (run this after to confirm)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'visits' AND column_name = 'form_submissions';

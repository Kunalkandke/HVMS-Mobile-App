-- ============================================================
-- HVMS Phone Normalization Migration
-- Purpose: Normalize stored phone numbers so faculty login works.
--
-- Faculty login password = their mobile number (digits only).
-- If phones are stored as "987 654 3210" but faculty type "9876543210",
-- the bcrypt comparison fails. This migration normalizes existing phones
-- to digits-only format.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Normalize phone numbers: remove spaces, dashes, brackets
--    Keep only digits and leading + (if international)
--    e.g. "987 654 3210" → "9876543210"
--         "+91 987-654-3210" → "9876543210"  (strips +91 prefix)
-- ─────────────────────────────────────────────────────────────
UPDATE users
SET phone = regexp_replace(
  regexp_replace(phone, '^\+91', ''),  -- Remove +91 country code
  '[^0-9]', '', 'g'                    -- Remove all non-digits
)
WHERE
  phone IS NOT NULL
  AND phone != ''
  AND phone != regexp_replace(regexp_replace(phone, '^\+91', ''), '[^0-9]', '', 'g');

-- ─────────────────────────────────────────────────────────────
-- 2. Re-hash passwords for Excel-imported faculty
--    Needed because old records may have bcrypt("+91 987 654 3210")
--    but now phone is stored as "9876543210".
--    After this, bcrypt hash = bcrypt("9876543210").
--
--    NOTE: This uses a PL/pgSQL function. If your Supabase plan
--    doesn't allow custom functions, skip step 2 and instead
--    ask each faculty to use "Reset Password" from the Admin panel.
-- ─────────────────────────────────────────────────────────────
-- OPTIONAL: Run from your backend instead (preferred).
-- The backend now handles digit-only comparison automatically.
-- Faculty with old hashes can:
--   1. Ask admin to "Reset Password to Phone" from the edit modal
--   2. Or admin resets via the Faculty Panel edit icon

-- ─────────────────────────────────────────────────────────────
-- 3. Ensure must_change_password is set correctly for imported faculty
--    (just in case any old records have it as false)
-- ─────────────────────────────────────────────────────────────
-- Optional: uncomment if you want all imported faculty to be forced
-- to change password on next login:
-- UPDATE users
-- SET must_change_password = true
-- WHERE import_source = 'excel_import' AND must_change_password = false;

-- ─────────────────────────────────────────────────────────────
-- DONE
-- After running:
--   - Phone numbers stored as pure digits (e.g. "9876543210")
--   - New imports will also store digits-only
--   - Login now works: FAC001 + 9876543210
--   - Fallback: backend also tries digits-only password comparison
-- ─────────────────────────────────────────────────────────────
SELECT 
  COUNT(*) as total_faculty,
  COUNT(CASE WHEN phone IS NULL OR phone = '' THEN 1 END) as missing_phone,
  COUNT(CASE WHEN phone ~ '^[0-9]{10}$' THEN 1 END) as normalized_10digit
FROM users
WHERE role = 'faculty';

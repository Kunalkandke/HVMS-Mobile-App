/**
 * Database Migration Script
 * Adds the form_submissions column to the visits table
 *
 * Run this script with: node scripts/add-form-submissions-column.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndAddColumn() {
  console.log('Checking if form_submissions column exists...\n');

  // Test if column exists by trying to select it
  const { data, error } = await supabase
    .from('visits')
    .select('form_submissions')
    .limit(1);

  if (error) {
    if (error.message?.includes('column') || error.code === '42703' || error.message?.includes('form_submissions')) {
      console.log('❌ Column "form_submissions" does NOT exist!\n');
      console.log('You need to run this SQL in your Supabase SQL Editor:\n');
      console.log('─'.repeat(60));
      console.log(`
-- Add the missing form_submissions column
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS form_submissions JSONB DEFAULT '[]'::jsonb;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_visits_form_submissions
ON visits USING gin (form_submissions);

-- Initialize existing visits with empty array
UPDATE visits
SET form_submissions = '[]'::jsonb
WHERE form_submissions IS NULL;
`);
      console.log('─'.repeat(60));
      console.log('\nGo to: https://supabase.com/dashboard → Your Project → SQL Editor');
      console.log('Paste the SQL above and click "Run"\n');
    } else {
      console.error('Database error:', error.message);
    }
  } else {
    console.log('✅ Column "form_submissions" EXISTS!');
    console.log('Database schema is correct.\n');

    // Check if any visits have form submissions
    const { data: visits, error: visitErr } = await supabase
      .from('visits')
      .select('id, form_submissions')
      .not('form_submissions', 'eq', '[]')
      .limit(5);

    if (visitErr) {
      console.log('Could not check for existing form submissions');
    } else if (visits && visits.length > 0) {
      console.log(`Found ${visits.length} visits with form submissions saved.`);
    } else {
      console.log('No form submissions saved yet.');
    }
  }
}

checkAndAddColumn().catch(console.error);

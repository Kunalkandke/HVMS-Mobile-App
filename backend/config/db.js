const { createClient } = require('@supabase/supabase-js');

const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = rawSupabaseUrl ? rawSupabaseUrl.trim().replace(/\/+$/, '') : '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error(
    'Invalid SUPABASE_URL. Use your project base URL, e.g. https://<project-ref>.supabase.co'
  );
}

if (parsedSupabaseUrl.pathname && parsedSupabaseUrl.pathname !== '/') {
  throw new Error(
    'Invalid SUPABASE_URL. It must not include path segments; use only the project base URL.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const connectDB = async () => {
  try {
    // Verify Supabase connectivity using Auth Admin API (independent of app tables).
    const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (authError) {
      throw new Error(authError.message);
    }

    // Non-fatal schema probe so server can still boot while DB schema is being initialized.
    const { error: usersProbeError } = await supabase.from('users').select('id').limit(1);
    if (usersProbeError && usersProbeError.code !== 'PGRST116') {
      console.warn('⚠️ Supabase connected, but app schema seems incomplete:', usersProbeError.message);
      console.warn('   Run backend/config/schema.sql in Supabase SQL Editor, then restart.');
    }

    console.log('✅ Supabase (PostgreSQL) connected');
  } catch (err) {
    const message = err?.message || String(err);
    if (message.includes("Unexpected token '<'")) {
      throw new Error(
        'Supabase returned HTML instead of JSON. Check SUPABASE_URL (must be the project base URL) and any proxy/network filters.'
      );
    }
    throw new Error(`Supabase connection failed: ${message}`);
  }
};

module.exports = { supabase, connectDB };

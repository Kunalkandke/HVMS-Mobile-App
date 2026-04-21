require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase, connectDB } = require('../config/db');

const seedAdmin = async () => {
  await connectDB();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  console.log('\n🌱 Seeding admin account...');

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', adminEmail)
    .maybeSingle();

  if (existing) {
    console.log(`✅ Admin already exists: ${adminEmail}`);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(adminPassword, 12);

  const { data, error } = await supabase
    .from('users')
    .insert({
      name: adminName,
      email: adminEmail,
      password: hashed,
      role: 'admin',
      is_active: true,
      must_change_password: false,
    })
    .select('id, name, email, role')
    .single();

  if (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Admin created successfully!');
  console.log('   Name  :', data.name);
  console.log('   Email :', data.email);
  console.log('   Pass  :', adminPassword, '(change after first login)\n');
  process.exit(0);
};

seedAdmin();

require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 HVMS API v2 running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database    : Supabase (PostgreSQL)`);
    console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
  });
};

startServer().catch((err) => {
  console.error('❌ Server failed to start:', err.message);
  process.exitCode = 1;
});

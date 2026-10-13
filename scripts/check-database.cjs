const path = require('node:path');
process.loadEnvFile(path.resolve(__dirname, '../apps/api/.env'));
const { PrismaClient } = require('../apps/api/node_modules/@prisma/client');
const db = new PrismaClient();
db.$connect().then(async () => {
  console.log('PostgreSQL connection successful.');
  console.log(`Campaigns: ${await db.campaign.count()}`);
}).catch(error => {
  console.error(`Database check failed: ${error.code || error.errorCode || 'UNKNOWN'}`);
  process.exitCode = 1;
}).finally(() => db.$disconnect());

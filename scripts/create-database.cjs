const path = require('node:path');
const { spawnSync } = require('node:child_process');
process.loadEnvFile(path.resolve(__dirname, '../apps/api/.env'));
const url = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
const psql = 'C:/Program Files/PostgreSQL/16/bin/psql.exe';
const args = ['-X', '-w', '-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const check = spawnSync(psql, [...args, '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${database}'`], {env, encoding:'utf8'});
if (check.status !== 0) { console.error(check.stderr); process.exit(1); }
if (check.stdout.trim() === '1') { console.log('Database already exists.'); process.exit(0); }
const create = spawnSync(psql, args, {env, input:`CREATE DATABASE "${database}";`, encoding:'utf8'});
console.log(create.stdout);
if (create.status !== 0) { console.error(create.stderr); process.exit(1); }

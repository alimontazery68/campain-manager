const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const envPath = path.resolve(__dirname, '../apps/api/.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const web = path.resolve(__dirname, '../apps/web');
const child = spawn(process.execPath, [path.join(web, 'node_modules/next/dist/bin/next'), process.argv[2] || 'dev', '-p', process.env.WEB_PORT || '3000','-H',process.env.WEB_HOST||'127.0.0.1'], { cwd: web, stdio: 'inherit', env: process.env });
child.on('exit', code => process.exit(code ?? 1));

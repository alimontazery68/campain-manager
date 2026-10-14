#!/usr/bin/env node
/** Reusable IPPanel Edge OTP sender. Node 18+; no dependencies. */
const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file = process.env.IPPANEL_ENV_FILE || '.env') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function config() {
  const required = ['IPPANEL_API_KEY', 'IPPANEL_FROM_NUMBER', 'IPPANEL_OTP_PATTERN_CODE'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return {
    baseUrl: (process.env.IPPANEL_BASE_URL || 'https://edge.ippanel.com/v1').replace(/\/$/, ''),
    apiKey: process.env.IPPANEL_API_KEY,
    from: process.env.IPPANEL_FROM_NUMBER,
    pattern: process.env.IPPANEL_OTP_PATTERN_CODE,
    timeout: Number(process.env.IPPANEL_TIMEOUT_SECONDS || 10),
    length: Number(process.env.OTP_LENGTH || 5),
  };
}

function normalizePhone(phone) {
  const value = String(phone || '').replace(/[\s-]/g, '');
  const normalized = value.startsWith('0') ? `+98${value.slice(1)}` : value.startsWith('98') ? `+${value}` : value;
  if (!/^\+98\d{10}$/.test(normalized)) throw new Error('Phone must be an Iranian mobile number, e.g. 09133731108');
  return normalized;
}

async function sendOtp(phone, code = null) {
  const c = config();
  const digits = Math.max(4, Math.min(8, c.length));
  const otp = code || String(Math.floor(Math.random() * (10 ** digits - 10 ** (digits - 1)) + 10 ** (digits - 1)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeout * 1000);
  try {
    const response = await fetch(`${c.baseUrl}/api/send`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: c.apiKey },
      body: JSON.stringify({
        sending_type: 'pattern', from_number: c.from, code: c.pattern,
        recipients: [normalizePhone(phone)], params: { 'verification-code': otp },
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.meta?.status === false) throw new Error(body?.meta?.message || `IPPanel HTTP ${response.status}`);
    return { accepted: true, otp, response: body };
  } finally { clearTimeout(timer); }
}

async function main() {
  loadEnv();
  const [command, phone, code] = process.argv.slice(2);
  if (command === 'send') {
    const result = await sendOtp(phone, code);
    console.log(JSON.stringify({ accepted: result.accepted, phone: normalizePhone(phone), provider: result.response?.meta?.message || 'accepted' }));
    return;
  }
  if (command === 'check') {
    config();
    console.log('IPPanel configuration is present.');
    return;
  }
  console.log('Usage: node scripts/ippanel-otp.cjs check');
  console.log('       node scripts/ippanel-otp.cjs send 09133731108');
  process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
module.exports = { sendOtp, normalizePhone };

import { Injectable, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from './prisma.service';

const normalizePhone = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(/[\s-]/g, '');
  const phone = raw.startsWith('+98') ? `0${raw.slice(3)}` : raw.startsWith('98') ? `0${raw.slice(2)}` : raw;
  if (!/^09\d{9}$/.test(phone)) throw new BadRequestException('شماره موبایل معتبر نیست.');
  return phone;
};

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private secret() { const value = process.env.AUTH_SESSION_SECRET; if (process.env.NODE_ENV === 'production' && (!value || value === 'change-me')) throw new Error('AUTH_SESSION_SECRET is required in production.'); return value || 'change-me'; }
  private setting(name: string, fallback: number) { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) ? value : fallback; }
  private sign(userId: string) { const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + this.setting('AUTH_SESSION_DAYS', 30) * 86400000 })).toString('base64url'); return `${payload}.${createHmac('sha256', this.secret()).update(payload).digest('base64url')}`; }
  verify(token: string) { const [payload, signature] = token.split('.'); if (!payload || !signature) throw new UnauthorizedException(); const expected = createHmac('sha256', this.secret()).update(payload).digest('base64url'); if (signature !== expected) throw new UnauthorizedException(); const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string; exp?: number }; if (!data.sub || !data.exp || data.exp < Date.now()) throw new UnauthorizedException(); return data.sub; }
  async session(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } }); if (!user) throw new UnauthorizedException(); return { user }; }
  async sendOtp(input: unknown) {
    const phone = normalizePhone((input as any)?.phone); const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
    const latest = await this.prisma.otpCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }); const resendSeconds = Math.max(0, this.setting('OTP_RESEND_SECONDS', 60));
    if (latest && Date.now() - latest.createdAt.getTime() < resendSeconds * 1000) throw new HttpException('لطفاً کمی بعد دوباره تلاش کنید.', HttpStatus.TOO_MANY_REQUESTS);
    const length = Math.max(4, Math.min(8, this.setting('OTP_LENGTH', 5))); const code = String(randomInt(10 ** (length - 1), 10 ** length));
    await this.prisma.otpCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } }); await this.prisma.otpCode.create({ data: { userId: user.id, codeHash: this.hash(code), expiresAt: new Date(Date.now() + this.setting('OTP_TTL_SECONDS', 120) * 1000) } }); await this.sendSms(phone, code); return { message: 'کد تایید ارسال شد.' };
  }
  async verifyOtp(input: unknown) {
    const phone = normalizePhone((input as any)?.phone); const code = String((input as any)?.code || ''); const length = Math.max(4, Math.min(8, this.setting('OTP_LENGTH', 5))); if (!new RegExp(`^\\d{${length}}$`).test(code)) throw new BadRequestException('کد تایید معتبر نیست.');
    const user = await this.prisma.user.findUnique({ where: { phone }, include: { otpCodes: { where: { consumedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } } }); const otp = user?.otpCodes[0]; const maxAttempts = Math.max(1, this.setting('OTP_MAX_ATTEMPTS', 5));
    if (!user || !otp || otp.expiresAt < new Date() || otp.attempts >= maxAttempts) throw new UnauthorizedException('کد تایید منقضی یا نامعتبر است.'); await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const actual = Buffer.from(this.hash(code)); const expected = Buffer.from(otp.codeHash); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException('کد تایید نامعتبر است.');
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }); // Legacy campaigns are assigned only to an explicitly configured owner.
    if (process.env.LEGACY_CAMPAIGN_OWNER_PHONE === user.phone) await this.prisma.campaign.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } }); return { token: this.sign(user.id), user: { id: user.id, phone: user.phone } };
  }
  async sendSms(phone: string, code: string) {
    if (process.env.SMS_ENABLED === '0') return; const base = (process.env.IPPANEL_BASE_URL || 'https://edge.ippanel.com/v1').replace(/\/$/, ''); const recipient = phone.startsWith('0') ? `+98${phone.slice(1)}` : phone; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.setting('IPPANEL_TIMEOUT_SECONDS', 10) * 1000);
    try { const response = await fetch(`${base}/api/send`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', authorization: process.env.IPPANEL_API_KEY || '' }, body: JSON.stringify({ sending_type: 'pattern', from_number: process.env.IPPANEL_FROM_NUMBER || process.env.SMS_SENDER, code: process.env.IPPANEL_OTP_PATTERN_CODE || process.env.SMS_PATTERN_CODE, recipients: [recipient], params: { 'verification-code': code } }) }); const body = await response.json().catch(() => null) as any; if (!response.ok || body?.meta?.status === false) throw new Error(`IPPanel SMS failed: ${body?.meta?.message || response.status}`); } finally { clearTimeout(timer); }
  }
}

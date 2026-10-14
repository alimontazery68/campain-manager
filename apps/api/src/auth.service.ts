import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from './prisma.service';

const normalizePhone = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(/[\s-]/g, '');
  const phone = raw.startsWith('+98') ? `0${raw.slice(3)}` : raw.startsWith('98') ? `0${raw.slice(2)}` : raw;
  if (!/^09\d{9}$/.test(phone)) throw new BadRequestException('شماره موبایل معتبر نیست.');
  return phone;
};

@Injectable() export class AuthService {
  constructor(private prisma: PrismaService) {}
  private hash(value:string) { return createHash('sha256').update(value).digest('hex'); }
  private sign(userId:string) { const payload = Buffer.from(JSON.stringify({sub:userId, exp:Date.now()+Number(process.env.AUTH_SESSION_DAYS||30)*86400000})).toString('base64url'); return `${payload}.${createHmac('sha256', process.env.AUTH_SESSION_SECRET || 'change-me').update(payload).digest('base64url')}`; }
  verify(token:string) { const [payload, sig] = token.split('.'); if (!payload || !sig) throw new UnauthorizedException(); const expected=createHmac('sha256',process.env.AUTH_SESSION_SECRET||'change-me').update(payload).digest('base64url'); if (sig!==expected) throw new UnauthorizedException(); const data=JSON.parse(Buffer.from(payload,'base64url').toString()); if(data.exp<Date.now()) throw new UnauthorizedException(); return data.sub as string; }
  async sendOtp(input:unknown) { const phone=normalizePhone((input as any)?.phone); const user=await this.prisma.user.upsert({where:{phone},create:{phone},update:{}}); const code=String(randomInt(100000,1000000)); await this.prisma.otpCode.updateMany({where:{userId:user.id,consumedAt:null},data:{consumedAt:new Date()}}); await this.prisma.otpCode.create({data:{userId:user.id,codeHash:this.hash(code),expiresAt:new Date(Date.now()+120000)}}); await this.sendSms(phone,code); return {message:'کد تایید ارسال شد.'}; }
  async verifyOtp(input:unknown) { const phone=normalizePhone((input as any)?.phone); const code=String((input as any)?.code||''); if(!/^\d{6}$/.test(code)) throw new BadRequestException('کد تایید معتبر نیست.'); const user=await this.prisma.user.findUnique({where:{phone},include:{otpCodes:{where:{consumedAt:null},orderBy:{createdAt:'desc'},take:1}}}); const otp=user?.otpCodes[0]; if(!user||!otp||otp.expiresAt<new Date()||otp.attempts>=5) throw new UnauthorizedException('کد تایید منقضی یا نامعتبر است.'); await this.prisma.otpCode.update({where:{id:otp.id},data:{attempts:{increment:1}}}); if(!timingSafeEqual(Buffer.from(otp.codeHash),Buffer.from(this.hash(code)))) throw new UnauthorizedException('کد تایید نامعتبر است.'); await this.prisma.otpCode.update({where:{id:otp.id},data:{consumedAt:new Date()}}); return {token:this.sign(user.id),user:{id:user.id,phone:user.phone}}; }
  async sendSms(phone:string, code:string) { const url=process.env.SMS_API_URL || 'https://ippanel.com/patterns/pattern'; const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:process.env.SMS_USERNAME,password:process.env.SMS_PASSWORD,from:process.env.SMS_SENDER,to:phone,pattern_code:process.env.SMS_PATTERN_CODE,input_data:{OTP:code}})}); if(!response.ok) throw new Error(`SMS provider returned ${response.status}`); }
}

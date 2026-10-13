import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from './prisma.service';
const metric=z.number().int().min(0).max(2147483647).nullable().optional();
export const DailyResultSchema=z.object({
  rating:z.enum(['WEAK','NORMAL','GOOD','GREAT']),views:metric,leads:metric,sales:metric,
  warmLeads:metric,notes:z.string().trim().max(5000).nullable().optional(),
  revenue:z.number().int().min(0).max(999999999999999).nullable().optional(),
  feedback:z.string().trim().max(5000).nullable().optional(),expectedUpdatedAt:z.string().datetime().nullable()
}).strict();
export function tehranDate(date:Date):string {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
@Injectable()
export class ResultsService {
  constructor(private db:PrismaService){}
  async save(dayId:string,input:unknown) {
    const parsed=DailyResultSchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('وضعیت روز را انتخاب کن و عددهای نامنفی معتبر وارد کن. متن بازخورد حداکثر ۵۰۰۰ کاراکتر است.');
    return this.db.$transaction(async tx=>{
      const day=await tx.campaignDay.findUnique({where:{id:dayId}});
      if(!day)throw new NotFoundException('روز کمپین پیدا نشد.');
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${day.campaignId} FOR UPDATE`;
      const campaign=await tx.campaign.findUnique({where:{id:day.campaignId}});
      if(!campaign||campaign.status==='DRAFT')throw new ConflictException('ابتدا طرح کمپین را تأیید کن.');
      if(campaign.status==='COMPLETED')throw new ConflictException('کمپین پایان یافته است؛ نتایج نهایی قابل تغییر نیستند.');
      if(tehranDate(day.date)>tehranDate(new Date()))throw new BadRequestException('برای روزی که هنوز نرسیده، نتیجه ثبت نمی‌شود.');
      const existing=await tx.dailyResult.findUnique({where:{dayId}});
      if((existing?.updatedAt.toISOString()??null)!==parsed.data.expectedUpdatedAt)
        throw new ConflictException('نتیجه در پنجره دیگری تغییر کرده است؛ متن خودت را نگه دار و صفحه را دوباره باز کن.');
      const {expectedUpdatedAt,...values}=parsed.data;
      const data={rating:values.rating,views:values.views??null,leads:values.leads??null,sales:values.sales??null,warmLeads:values.warmLeads??null,notes:values.notes||null,revenue:values.revenue??null,feedback:values.feedback||null};
      return tx.dailyResult.upsert({where:{dayId},create:{dayId,...data},update:data});
    });
  }
}

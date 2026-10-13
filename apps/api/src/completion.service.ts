import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from './prisma.service';
import { tehranDate } from './results.service';
import { analysisSnapshot } from './ai/analysis.service';
const include={preparationTasks:{orderBy:{position:'asc' as const}},days:{orderBy:{dayNumber:'asc' as const},include:{result:true,tasks:{where:{archived:false},orderBy:{id:'asc' as const}}}}};
export function completionSummary(c:any){
  const results=c.days.flatMap((d:any)=>d.result?[d.result]:[]),tasks=c.days.flatMap((d:any)=>d.tasks);
  const metrics=Object.fromEntries(['views','leads','warmLeads','sales','revenue'].map(key=>{
    const known=results.filter((r:any)=>r[key]!==null&&r[key]!==undefined);
    return [key,{total:known.length?known.reduce((sum:bigint,r:any)=>sum+BigInt(r[key].toString()),0n).toString():null,reportedDays:known.length}];
  }));
  return {preparation:{total:c.preparationTasks?.length??0,completed:c.preparationTasks?.filter((t:any)=>t.completed).length??0,initialized:c.preparationInitialized??false},totalDays:c.days.length,reportedDays:results.length,missingResultDays:c.days.filter((d:any)=>!d.result).map((d:any)=>d.dayNumber),totalTasks:tasks.length,completedTasks:tasks.filter((t:any)=>t.status==='DONE').length,metrics,
    feedback:c.days.filter((d:any)=>d.result?.feedback).map((d:any)=>({dayNumber:d.dayNumber,text:d.result.feedback})),
    hasFutureDays:c.days.some((d:any)=>tehranDate(new Date(d.date))>tehranDate(new Date())),
    limitations:['جمع‌ها فقط مربوط به روزها و عددهای ثبت‌شده‌اند؛ مقدار نامعلوم صفر نیست.','بازدیدها و سرنخ‌ها مجموع روزانه‌اند و لزوماً افراد یکتا نیستند.','آموخته‌ها برداشت تأییدشده کاربر هستند، نه اثبات علت و معلول یا تضمین نتیجه.']};
}
@Injectable()
export class CompletionService {
 constructor(private db:PrismaService){}
 async get(id:string){const c=await this.db.campaign.findUnique({where:{id},include});if(!c)throw new NotFoundException('کمپین پیدا نشد.');return {sourceHash:analysisSnapshot(c).hash,status:c.status,summary:completionSummary(c),completion:c.completion};}
 async complete(id:string,input:unknown){
  const parsed=z.object({sourceHash:z.string().length(64),confirm:z.literal(true),allowEarly:z.boolean().default(false),learnings:z.array(z.string().trim().min(1).max(3000)).max(30)}).strict().safeParse(input);
  if(!parsed.success)throw new BadRequestException('تأیید پایان و نکته‌های معتبر لازم است؛ حداکثر ۳۰ نکته.');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
   await tx.$queryRaw`SELECT t.id FROM "Task" t JOIN "CampaignDay" d ON d.id = t."dayId" WHERE d."campaignId" = ${id} FOR UPDATE OF t`;
   const c=await tx.campaign.findUnique({where:{id},include});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
   if(c.status==='COMPLETED'){
    const saved=c.completion as any;
    if(saved?.sourceHash===parsed.data.sourceHash&&JSON.stringify(saved.learnings)===JSON.stringify(parsed.data.learnings))return c;
    throw new ConflictException('کمپین قبلاً پایان یافته است.');
   }
   if(c.status!=='ACTIVE')throw new ConflictException('فقط کمپین فعال قابل پایان است.');
   if(analysisSnapshot(c).hash!==parsed.data.sourceHash)throw new ConflictException('اطلاعات تغییر کرده است؛ جمع‌بندی را دوباره باز کن.');
   const summary=completionSummary(c);
   if(summary.hasFutureDays&&!parsed.data.allowEarly)throw new BadRequestException('برای پایان پیش از موعد، گزینه پایان زودهنگام را تأیید کن.');
   const completion={sourceHash:parsed.data.sourceHash,completedAt:new Date().toISOString(),learnings:parsed.data.learnings,summary};
   return tx.campaign.update({where:{id},data:{status:'COMPLETED',completion},include});
  });
 }
}

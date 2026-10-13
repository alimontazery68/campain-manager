import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AI_PROVIDER, AiProvider } from './provider';
import { planningPrompt, validatePlan, validateStoredPlan } from './planning';
import { buildPlanningInput } from './planning-context';
import { initializePreparation } from '../preparation.service';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { normalizedContext } from '../campaign-context';
@Injectable()
export class PlanningService {
  private running = new Set<string>();
  constructor(private db:PrismaService,@Inject(AI_PROVIDER) private provider:AiProvider) {}
  async edit(id:string,input:unknown){
    const p=z.object({expectedPlan:z.unknown(),plan:z.unknown()}).strict().safeParse(input);if(!p.success)throw new BadRequestException('طرح معتبر لازم است.');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const c=await tx.campaign.findUnique({where:{id}});if(!c||c.status!=='DRAFT')throw new ConflictException('طرح فقط پیش از تأیید قابل ویرایش است.');
      if(!isDeepStrictEqual(c.aiPlan,p.data.expectedPlan))throw new ConflictException('طرح تغییر کرده؛ دوباره بخوان.');
      let plan;try{plan=validateStoredPlan(p.data.plan,c.duration,c.maxContentPerDay);}catch{throw new BadRequestException('تغییر طرح، روزها یا سقف محتوا معتبر نیست.');}
      await tx.campaignChange.create({data:{campaignId:id,source:'MANUAL_PLAN',reason:'ویرایش طرح پیش از تأیید',data:JSON.parse(JSON.stringify({before:c.aiPlan,after:plan}))}});
      return tx.campaign.update({where:{id},data:{aiPlan:plan}});
    });
  }
  async generate(id:string) {
    const campaign=await this.db.campaign.findUnique({where:{id}});
    if(!campaign) throw new BadRequestException('کمپین پیدا نشد.');
    if(campaign.aiPlan) return campaign;
    if(campaign.status!=='DRAFT') throw new ConflictException('طرح جدید فقط برای پیش‌نویس ساخته می‌شود.');
    if(campaign.duration>14) throw new BadRequestException('ساخت طرح هوشمند فعلاً برای کمپین‌های حداکثر ۱۴ روزه فعال است.');
    if(this.running.has(id)) throw new ConflictException('ساخت طرح در حال انجام است؛ کمی صبر کن.');
    this.running.add(id);
    try {
      const input=buildPlanningInput(campaign);
      const raw=await this.provider.json(planningPrompt,{...input,normalizedContext:normalizedContext(campaign)});
      let plan;
      try {plan=validatePlan(raw,campaign.duration,campaign.maxContentPerDay);} catch {throw new ServiceUnavailableException('طرح دریافت‌شده معتبر نبود و ذخیره نشد. اطلاعات قبلی محفوظ است؛ دوباره تلاش کن.');}
      return await this.db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
        const fresh=await tx.campaign.findUnique({where:{id}});
        if(!fresh||fresh.status!=='DRAFT'||fresh.updatedAt.toISOString()!==campaign.updatedAt.toISOString())throw new ConflictException('کمپین هنگام ساخت طرح تغییر کرده یا حذف شده؛ پاسخ قدیمی ذخیره نشد. دوباره بررسی کن.');
        if(fresh.aiPlan)return fresh;
        return tx.campaign.update({where:{id},data:{aiPlan:plan}});
      });
    } finally {this.running.delete(id);}
  }
  async approve(id:string) {
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const campaign=await tx.campaign.findUnique({where:{id},include:{days:{include:{tasks:true},orderBy:{dayNumber:'asc'}}}});
      if(!campaign?.aiPlan) throw new BadRequestException('ابتدا طرح کمپین را بساز.');
      if(campaign.status==='ACTIVE') return tx.campaign.findUnique({where:{id},include:{days:{include:{tasks:{where:{archived:false}}},orderBy:{dayNumber:'asc'}}}});
      if(campaign.status!=='DRAFT') throw new ConflictException('وضعیت کمپین برای تأیید طرح مناسب نیست.');
      const plan=validateStoredPlan(campaign.aiPlan,campaign.duration,campaign.maxContentPerDay);
      await initializePreparation(tx,id,plan.preparation);
      const preparation=await tx.preparationTask.findMany({where:{campaignId:id}});
      const start = campaign.startDate??new Date();
      for(const day of plan.days) {
        const existing=campaign.days.find(d=>d.dayNumber===day.dayNumber);
        const {tasks,...guidance}=day;
        const data={date:new Date(start.getTime()+(day.dayNumber-1)*86400000),phase:day.phase,mission:day.mission,objective:day.objective,guidance:JSON.parse(JSON.stringify(guidance)),tasks:{create:tasks.map((t,position)=>{
          const {timeSlot,contentFunction,topic,angle,hookDirection,keyPoints,preparationTitles,...fields}=t as any;
          const titles=preparationTitles??(fields.requiredAsset?[fields.requiredAsset]:[]);
          return {...fields,position,preparationIds:preparation.filter(p=>titles.includes(p.title)).map(p=>p.id),metadata:JSON.parse(JSON.stringify({timeSlot,contentFunction,topic,angle,hookDirection,keyPoints}))};
        })}};
        if(existing) {
          await tx.task.updateMany({where:{dayId:existing.id,archived:false},data:{archived:true}});
          await tx.campaignDay.update({where:{id:existing.id},data});
        } else {
          await tx.campaignDay.create({data:{campaignId:id,dayNumber:day.dayNumber,...data}});
        }
      }
      return tx.campaign.update({where:{id},data:{status:'ACTIVE'},include:{days:{include:{tasks:{where:{archived:false}}},orderBy:{dayNumber:'asc'}}}});
    },{timeout:20000});
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from './prisma.service';
import { validateStoredPlan } from './ai/planning';
type Item={title:string;why:string;requiredBeforeDay?:number};
export async function initializePreparation(tx:Prisma.TransactionClient,id:string,items:Item[]){
  if(items.length)await tx.preparationTask.createMany({data:items.map((item,position)=>({campaignId:id,position,title:item.title,why:item.why,requiredBeforeDay:item.requiredBeforeDay??null})),skipDuplicates:true});
  await tx.campaign.update({where:{id},data:{preparationInitialized:true}});
}
@Injectable()
export class PreparationService {
 constructor(private db:PrismaService){}
 async get(id:string){
  const c=await this.db.campaign.findUnique({where:{id},include:{preparationTasks:{orderBy:{position:'asc'}}}});
  if(!c)throw new NotFoundException('کمپین پیدا نشد.');
  return {status:c.status,initialized:c.preparationInitialized,items:c.status==='DRAFT'?[]:c.preparationTasks};
 }
 async initialize(id:string){
  await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
   const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
   if(c.status!=='ACTIVE')throw new ConflictException('چک‌لیست فقط برای کمپین فعال ساخته می‌شود.');
   if(c.preparationInitialized)return;
   let plan;try{plan=validateStoredPlan(c.aiPlan,c.duration,c.maxContentPerDay);}catch{throw new BadRequestException('طرح ذخیره‌شده معتبر نیست؛ چک‌لیست تغییر نکرد.');}
   await initializePreparation(tx,id,plan.preparation);
  });
  return this.get(id);
 }
 async update(id:string,input:unknown){
  const parsed=z.object({completed:z.boolean(),expectedCompleted:z.boolean(),expectedUpdatedAt:z.string().datetime()}).strict().safeParse(input);
  if(!parsed.success)throw new BadRequestException('درخواست ثبت آماده‌سازی معتبر نیست.');
  return this.db.$transaction(async tx=>{
   const item=await tx.preparationTask.findUnique({where:{id}});if(!item)throw new NotFoundException('مورد آماده‌سازی پیدا نشد.');
   await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${item.campaignId} FOR UPDATE`;
   const c=await tx.campaign.findUnique({where:{id:item.campaignId}});
   if(c?.status!=='ACTIVE')throw new ConflictException('کمپین فعال نیست؛ چک‌لیست فقط قابل مشاهده است.');
   const current=await tx.preparationTask.findUniqueOrThrow({where:{id}});
   if(current.updatedAt.toISOString()!==parsed.data.expectedUpdatedAt||current.completed!==parsed.data.expectedCompleted)throw new ConflictException('وضعیت در پنجره دیگری تغییر کرده؛ چک‌لیست را دوباره بخوان.');
   return tx.preparationTask.update({where:{id},data:{completed:parsed.data.completed}});
  });
 }
}

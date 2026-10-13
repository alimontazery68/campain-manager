import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { tehranDate } from '../results.service';
import { AI_PROVIDER, AiProvider } from './provider';
import { OptimizationTaskSchema, optimizationPrompt, optimizationInput, eligibleDays, eligibleTask, validateOptimization, applyOptimization } from './optimization';
// Legacy saved reviews remain readable/applicable with their original conservative safety rules.
const text=z.string().trim().min(1).max(3000);
export const AnalysisSchema=z.object({summary:text,observations:z.array(text).max(12),recommendations:z.array(text).max(12),limitations:z.array(text).min(1).max(12),changes:z.array(z.object({dayId:text,reason:text,mission:text,objective:text,tasks:z.array(OptimizationTaskSchema).min(1).max(20)}).strict()).max(14)}).strict();
export const analysisPrompt=optimizationPrompt;
const include={changes:{where:{source:'AI_APPROVED'},orderBy:{createdAt:'asc' as const}},preparationTasks:{orderBy:{position:'asc' as const}},days:{orderBy:{dayNumber:'asc' as const},include:{result:true,tasks:{where:{archived:false},orderBy:[{position:'asc' as const},{id:'asc' as const}]}}}};
export function analysisSnapshot(c:any,today=tehranDate(new Date())){
 const {analysis,learning,updatedAt,createdAt,...data}=c;
 return {hash:createHash('sha256').update(JSON.stringify({today,data})).digest('hex'),input:optimizationInput(c,today)};
}
export function validateAnalysis(raw:unknown,c:any){
 const report=AnalysisSchema.parse(raw),eligible=eligibleDays(c).filter((d:any)=>d.tasks.every(eligibleTask)),seen=new Set<string>();
 for(const ch of report.changes){if(seen.has(ch.dayId)||!eligible.some((d:any)=>d.id===ch.dayId))throw new Error('Invalid day');seen.add(ch.dayId);if(ch.tasks.length>8||ch.tasks.filter(t=>t.type==='CONTENT').length>c.maxContentPerDay)throw new Error('Capacity');}return report;
}
@Injectable()
export class AnalysisService{
 private running=new Set<string>();
 constructor(private db:PrismaService,@Inject(AI_PROVIDER) private provider:AiProvider){}
 private async campaign(id:string){const c=await this.db.campaign.findUnique({where:{id},include});if(!c)throw new NotFoundException('کمپین پیدا نشد.');return c;}
 async get(id:string){const c=await this.campaign(id),saved=c.analysis as any;return saved?{...saved,stale:saved.status==='PENDING'&&saved.sourceHash!==analysisSnapshot(c).hash}:null;}
 async generate(id:string){
  const c=await this.campaign(id);if(c.status!=='ACTIVE')throw new ConflictException('تحلیل فقط برای کمپین فعال است.');
  if(!c.days.some(d=>d.result))throw new BadRequestException('ابتدا نتیجه حداقل یک روز را ثبت کن.');
  const snapshot=analysisSnapshot(c),previous=c.analysis as any;
  if(previous?.sourceHash===snapshot.hash)return previous;
  if(this.running.has(id))throw new ConflictException('تحلیل در حال انجام است.');this.running.add(id);
  let requestId:string|undefined;
  try{
   const reservation=await this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
    const current=await tx.campaign.findUniqueOrThrow({where:{id},include});
    if(current.status!=='ACTIVE'||analysisSnapshot(current).hash!==snapshot.hash)throw new ConflictException('اطلاعات تغییر کرده؛ دوباره بررسی کن.');
    const cached=current.analysis as any;if(cached?.sourceHash===snapshot.hash)return {cached};
    const last=await tx.campaignChange.findFirst({where:{campaignId:id,source:'AI_REVIEW_REQUEST'},orderBy:{createdAt:'desc'}});
    if((last?.data as any)?.status==='RUNNING'&&Date.now()-last!.createdAt.getTime()<180000)throw new ConflictException('بررسی دیگری در حال انجام است؛ کمی صبر کن.');
    const request=await tx.campaignChange.create({data:{campaignId:id,source:'AI_REVIEW_REQUEST',reason:'درخواست صریح بررسی',data:{sourceHash:snapshot.hash,status:'RUNNING'}}});return {id:request.id};
   });
   if(reservation.cached)return reservation.cached;requestId=reservation.id;
   let report;
   try{report=validateOptimization(await this.provider.json(analysisPrompt,snapshot.input),c);}
   catch{throw new ServiceUnavailableException('در بررسی کمپین مشکلی پیش آمد. نتیجه ثبت‌شده محفوظ است؛ دوباره بررسی را انجام بده.');}
   return await this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
    const fresh=await tx.campaign.findUniqueOrThrow({where:{id},include});
    const latest=await tx.campaignChange.findFirst({where:{campaignId:id,source:'AI_REVIEW_REQUEST'},orderBy:{createdAt:'desc'}});
    if(latest?.id!==requestId)throw new ConflictException('درخواست جدیدتری ثبت شده است؛ این پاسخ اعمال نمی‌شود.');
    if(fresh.status!=='ACTIVE'||analysisSnapshot(fresh).hash!==snapshot.hash)throw new ConflictException('اطلاعات تغییر کرده؛ دوباره بررسی وضعیت را بزن.');
    const beforeDays=c.days.filter(d=>report.recommendation.proposedChanges.some(ch=>ch.targetDayNumber===d.dayNumber||d.tasks.some(t=>t.id===ch.targetTaskId))).map(d=>({id:d.id,dayNumber:d.dayNumber,mission:d.mission,tasks:d.tasks}));
    const result={sourceHash:snapshot.hash,status:'PENDING',createdAt:new Date().toISOString(),report,beforeDays:JSON.parse(JSON.stringify(beforeDays))};
    await tx.campaign.update({where:{id},data:{analysis:result}});
    await tx.campaignChange.update({where:{id:requestId!},data:{data:{sourceHash:snapshot.hash,status:'DONE'}}});
    await tx.campaignChange.create({data:{campaignId:id,source:'AI_PROPOSED',reason:report.summary,data:JSON.parse(JSON.stringify({sourceHash:snapshot.hash,report,beforeDays}))}});return result;
   });
  }catch(error){if(requestId)await this.db.campaignChange.updateMany({where:{id:requestId},data:{data:{sourceHash:snapshot.hash,status:'FAILED'}}}).catch(()=>undefined);throw error;}
  finally{this.running.delete(id);}
 }
 async decide(id:string,input:unknown){
  const parsed=z.object({sourceHash:z.string(),action:z.enum(['apply','dismiss'])}).strict().safeParse(input);if(!parsed.success)throw new BadRequestException('درخواست تأیید معتبر نیست.');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
   const c=await tx.campaign.findUnique({where:{id},include});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
   const saved=c.analysis as any;if(!saved||saved.sourceHash!==parsed.data.sourceHash)throw new ConflictException('پیشنهاد دیگری ذخیره شده؛ صفحه را تازه کن.');
   const status=parsed.data.action==='apply'?'APPLIED':'DISMISSED';
   if(saved.status===status)return saved;if(saved.status!=='PENDING'||c.status!=='ACTIVE')throw new ConflictException('این پیشنهاد دیگر قابل تأیید نیست.');
   if(parsed.data.action==='apply'){
    if(analysisSnapshot(c).hash!==saved.sourceHash)throw new ConflictException('نتایج یا برنامه تغییر کرده؛ دوباره بررسی وضعیت را بزن.');
    if(saved.report.schemaVersion===2){
     let report;try{report=validateOptimization(saved.report,c);}catch{throw new ConflictException('پیشنهاد دیگر قابل اعمال نیست؛ برنامه محفوظ است. دوباره بررسی کن.');}
     if(report.recommendation.proposedChanges.length)await applyOptimization(tx,c,report,saved.sourceHash);
    }else{
     const report=validateAnalysis(saved.report,c);
     for(const ch of report.changes){
      const day=c.days.find(d=>d.id===ch.dayId)!;
      await tx.task.updateMany({where:{dayId:day.id,archived:false},data:{archived:true}});
      await tx.campaignDay.update({where:{id:day.id},data:{mission:ch.mission,objective:ch.objective,tasks:{create:ch.tasks.map((t,position)=>({...t,position}))}}});
      await tx.campaignChange.create({data:{campaignId:id,source:'AI_APPROVED',reason:ch.reason,data:JSON.parse(JSON.stringify({before:day,after:ch,sourceHash:saved.sourceHash}))}});
     }
    }
   }
   const result={...saved,status,decidedAt:new Date().toISOString()};
   if(parsed.data.action==='dismiss')await tx.campaignChange.create({data:{campaignId:id,source:'AI_DISMISSED',reason:'رد پیشنهاد توسط کاربر؛ برنامه تغییر نکرد',data:{sourceHash:saved.sourceHash}}});
   else if(saved.report.schemaVersion===2&&!saved.report.recommendation.proposedChanges.length)await tx.campaignChange.create({data:{campaignId:id,source:'AI_CONTINUED',reason:'تأیید ادامه برنامه بدون تغییر',data:{sourceHash:saved.sourceHash}}});
   await tx.campaign.update({where:{id},data:{analysis:result}});return result;
  });
 }
}

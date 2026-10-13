import { BadRequestException,ConflictException,Injectable,NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from './prisma.service';
import { tehranDate } from './results.service';
const text=z.string().trim().min(1).max(3000),optional=z.string().trim().max(3000).nullable();
const Fields=z.object({title:text,type:z.enum(['CONTENT','OPERATIONAL','SALES','SUPPORT','PREPARATION','FOLLOW_UP','MEASUREMENT']),format:optional,why:text,cta:optional,objective:optional,requiredAsset:optional,preparationIds:z.array(z.string()).max(20),metadata:z.object({timeSlot:optional.optional(),contentFunction:optional.optional(),topic:optional.optional(),angle:optional.optional(),hookDirection:optional.optional(),keyPoints:z.array(text).max(8).optional()}).strict().optional()}).strict();
const Edit=z.object({expectedUpdatedAt:z.string().datetime(),reason:text,action:z.enum(['edit','archive','move','lock','unlock','skip','restore']),fields:Fields.optional(),dayId:z.string().optional(),position:z.number().int().nonnegative().optional()}).strict();
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
@Injectable()
export class TaskControlsService {
 constructor(private db:PrismaService){}
 private async lock(tx:any,campaignId:string){await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;const c=await tx.campaign.findUnique({where:{id:campaignId}});if(c?.status!=='ACTIVE')throw new ConflictException('فقط برنامه کمپین فعال قابل تغییر است.');return c;}
 private day(day:any){if(!day||tehranDate(day.date)<tehranDate(new Date())||day.result)throw new ConflictException('ساختار روز گذشته یا روز دارای نتیجه تغییر نمی‌کند.');}
 private async capacity(tx:any,dayId:string,max:number,exclude?:string,newType?:string){const count=await tx.task.count({where:{dayId,archived:false,type:'CONTENT',...(exclude?{id:{not:exclude}}:{})}});if(count+(newType==='CONTENT'?1:0)>max)throw new BadRequestException('سقف محتوای روزانه رعایت نشده است.');}
 private async dependencies(tx:any,campaignId:string,ids:string[]){if(new Set(ids).size!==ids.length||await tx.preparationTask.count({where:{id:{in:ids},campaignId}})!==ids.length)throw new BadRequestException('پیش‌نیاز باید از آماده‌سازی همین کمپین انتخاب شود.');}
 async history(id:string){if(!await this.db.campaign.findUnique({where:{id}}))throw new NotFoundException('کمپین پیدا نشد.');return this.db.campaignChange.findMany({where:{campaignId:id,source:{not:'AI_REVIEW_REQUEST'}},orderBy:{createdAt:'desc'}});}
 async add(dayId:string,input:unknown){
  const p=z.object({fields:Fields,reason:text}).strict().safeParse(input);if(!p.success)throw new BadRequestException('عنوان، دلیل و اطلاعات کار را بررسی کن.');
  return this.db.$transaction(async tx=>{
   const initial=await tx.campaignDay.findUnique({where:{id:dayId}});if(!initial)throw new NotFoundException('روز پیدا نشد.');
   const c=await this.lock(tx,initial.campaignId),day=await tx.campaignDay.findUnique({where:{id:dayId},include:{result:true}});this.day(day);
   if(await tx.task.count({where:{dayId,archived:false}})>=8)throw new BadRequestException('برای ساده ماندن اجرا، حداکثر ۸ کار در هر روز ثبت کن.');
   await this.capacity(tx,dayId,c.maxContentPerDay,undefined,p.data.fields.type);await this.dependencies(tx,c.id,p.data.fields.preparationIds);
   if(p.data.fields.type==='CONTENT'&&!p.data.fields.format)throw new BadRequestException('قالب محتوای این کار را مشخص کن.');
   const max=await tx.task.aggregate({where:{dayId},_max:{position:true}});
   const item=await tx.task.create({data:{dayId,...p.data.fields,position:(max._max.position??-1)+1}});
   await tx.campaignChange.create({data:{campaignId:c.id,source:'MANUAL_ADD',reason:p.data.reason,data:json({after:item})}});return item;
  });
 }
 async update(id:string,input:unknown){
  const p=Edit.safeParse(input);if(!p.success)throw new BadRequestException('درخواست ویرایش معتبر نیست.');
  return this.db.$transaction(async tx=>{
   const first=await tx.task.findUnique({where:{id},include:{day:true}});if(!first)throw new NotFoundException('کار پیدا نشد.');
   const c=await this.lock(tx,first.day.campaignId),task=await tx.task.findUniqueOrThrow({where:{id},include:{day:{include:{result:true}}}});
   if(task.archived||task.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('کار تغییر کرده یا بایگانی شده؛ صفحه را دوباره بخوان.');
   const {action,reason}=p.data;
   if(task.status==='DONE')throw new ConflictException('کار انجام‌شده تغییر نمی‌کند.');
   if(task.locked&&action!=='unlock')throw new ConflictException('ابتدا قفل کار را باز کن.');
   const data:any={};
   if(action==='lock'||action==='unlock')data.locked=action==='lock';
   else if(action==='skip'||action==='restore')data.status=action==='skip'?'SKIPPED':'PENDING';
   else {
    this.day(task.day);
    if(action==='archive')data.archived=true;
    if(action==='edit'){
     if(!p.data.fields)throw new BadRequestException('اطلاعات جدید کار لازم است.');
     if(task.content&&p.data.fields.type!=='CONTENT')throw new ConflictException('نوع کار دارای متن ذخیره‌شده تغییر نمی‌کند.');
     if(p.data.fields.type==='CONTENT'&&!p.data.fields.format)throw new BadRequestException('قالب محتوا لازم است.');
     await this.dependencies(tx,c.id,p.data.fields.preparationIds);await this.capacity(tx,task.dayId,c.maxContentPerDay,id,p.data.fields.type);Object.assign(data,p.data.fields);
    }
    if(action==='move'){
     if(!p.data.dayId||p.data.position===undefined)throw new BadRequestException('روز مقصد و جایگاه لازم است.');
     const dest=await tx.campaignDay.findUnique({where:{id:p.data.dayId},include:{result:true}});if(dest?.campaignId!==c.id)throw new BadRequestException('مقصد باید در همین کمپین باشد.');this.day(dest);
     await this.capacity(tx,dest!.id,c.maxContentPerDay,id,task.type);
     const others=await tx.task.findMany({where:{dayId:dest!.id,archived:false,id:{not:id}},orderBy:[{position:'asc'},{id:'asc'}]});
     if(p.data.position>others.length)throw new BadRequestException('جایگاه مقصد معتبر نیست.');
     const position=p.data.position;
     if(others.some((t,i)=>(t.locked||t.status==='DONE')&&t.position!==(i>=position?i+1:i)))throw new ConflictException('جابه‌جایی نباید جایگاه کار قفل‌شده یا انجام‌شده را تغییر دهد.');
     for(let i=0;i<others.length;i++){const next=i>=position?i+1:i;if(next!==others[i].position)await tx.task.update({where:{id:others[i].id},data:{position:next}});}
     data.dayId=dest!.id;data.position=p.data.position;
    }
   }
   const after=await tx.task.update({where:{id},data});
   await tx.campaignChange.create({data:{campaignId:c.id,source:'MANUAL_'+action.toUpperCase(),reason,data:json({before:task,after})}});return after;
  });
 }
 async mission(id:string,input:unknown){
  const p=z.object({mission:text,objective:text,phase:text,reason:text,expectedMission:text,expectedObjective:text,expectedPhase:text}).strict().safeParse(input);if(!p.success)throw new BadRequestException('مأموریت و هدف معتبر لازم است.');
  return this.db.$transaction(async tx=>{
   const first=await tx.campaignDay.findUnique({where:{id}});if(!first)throw new NotFoundException('روز پیدا نشد.');await this.lock(tx,first.campaignId);
   const day=await tx.campaignDay.findUniqueOrThrow({where:{id},include:{result:true,tasks:{where:{archived:false}}}});this.day(day);
   if(day.tasks.some(t=>t.locked||t.status==='DONE'||t.content))throw new ConflictException('مأموریت روز دارای کار قفل‌شده، انجام‌شده یا متن محفوظ تغییر نمی‌کند.');
   if(day.mission!==p.data.expectedMission||day.objective!==p.data.expectedObjective||day.phase!==p.data.expectedPhase)throw new ConflictException('مأموریت تغییر کرده؛ صفحه را تازه کن.');
   const after=await tx.campaignDay.update({where:{id},data:{mission:p.data.mission,objective:p.data.objective,phase:p.data.phase}});
   await tx.campaignChange.create({data:{campaignId:day.campaignId,source:'MANUAL_MISSION',reason:p.data.reason,data:json({before:day,after})}});return after;
  });
 }
}

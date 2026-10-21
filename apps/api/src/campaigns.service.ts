import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateCampaignSchema } from './campaigns.dto';
import { normalizedContext } from './campaign-context';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { validateStoredPlan } from './ai/planning';
import { methodHash } from './ai/campaign-methods';
const include = {preparationTasks:{orderBy:{position:'asc' as const}},days: { include: { result:true, tasks: { where: { archived: false },orderBy:[{position:'asc' as const},{id:'asc' as const}] } }, orderBy: { dayNumber: 'asc' as const } } };
@Injectable()
export class CampaignsService {
  constructor(private db: PrismaService) {}
  list(userId?:string) { return this.db.campaign.findMany({ where:userId?{ownerId:userId}:undefined, include, orderBy: { updatedAt: 'desc' } }); }
  private async deletionSnapshot(client:any,id:string){
    const c=await client.campaign.findUnique({where:{id},include:{days:{orderBy:{id:'asc'},include:{tasks:{orderBy:{id:'asc'}},result:true}},preparationTasks:{orderBy:{id:'asc'}},changes:{orderBy:{id:'asc'}}}});
    if(!c)throw new NotFoundException('کمپین پیدا نشد.');
    return {campaign:c,token:createHash('sha256').update(JSON.stringify(c)).digest('hex')};
  }
  async deletionPreview(id:string){const {campaign:c,token}=await this.deletionSnapshot(this.db,id);return {token,name:c.name,days:c.days.length,tasks:c.days.reduce((n:number,d:any)=>n+d.tasks.length,0),results:c.days.filter((d:any)=>d.result).length};}
  async remove(id:string,input:unknown){
    const p=z.object({token:z.string().length(64),name:z.string(),confirm:z.literal(true)}).strict().safeParse(input);if(!p.success)throw new BadRequestException('برای حذف، نام کمپین و تأیید صریح لازم است.');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const {campaign,token}=await this.deletionSnapshot(tx,id);
      if(token!==p.data.token)throw new ConflictException('اطلاعات کمپین تغییر کرده؛ قبل از حذف دوباره بررسی کن.');
      if(campaign.name!==p.data.name)throw new BadRequestException('نام کمپین را دقیقاً وارد کن.');
      await tx.campaign.delete({where:{id}});return {id,deleted:true};
    });
  }
  async replan(id:string,input:unknown){
    const p=z.object({expectedUpdatedAt:z.string().datetime(),confirm:z.literal(true)}).strict().safeParse(input);if(!p.success)throw new BadRequestException('تأیید کنارگذاشتن طرح قبلی لازم است.');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
      if(c.status!=='DRAFT'||c.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('فقط پیش‌نویس با نسخه فعلی قابل بازسازی است؛ برای کمپین اجراشده نسخه تازه بساز.');
      await tx.campaignChange.create({data:{campaignId:id,source:'MANUAL_REPLAN',reason:'کنارگذاشتن طرح پیش‌نویس با تأیید کاربر',data:JSON.parse(JSON.stringify({before:c.aiPlan}))}});
      return tx.campaign.update({where:{id},data:{aiPlan:Prisma.DbNull,analysis:Prisma.DbNull},include});
    });
  }
  async copyForEditing(id:string,input:unknown){
    const p=z.object({expectedUpdatedAt:z.string().datetime(),fields:CreateCampaignSchema,key:z.string().uuid(),confirm:z.literal(true)}).strict().safeParse(input);if(!p.success)throw new BadRequestException('اطلاعات نسخه تازه معتبر نیست.');
    const hash=createHash('sha256').update(JSON.stringify(p.data.fields)).digest('hex');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
      const previous=await tx.campaign.findUnique({where:{creationKey:p.data.key},include});
      if(previous){if(previous.ownerId!==c.ownerId||previous.creationPayloadHash!==hash)throw new ConflictException('نسخه تازه قبلاً با اطلاعات متفاوت ثبت شده؛ فهرست را بررسی کن.');return previous;}
      if(c.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('اطلاعات کمپین تغییر کرده؛ دوباره بخوان.');
      const {executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=p.data.fields;
      const after=await tx.campaign.create({data:{...base,ownerId:c.ownerId,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):null,creationKey:p.data.key,creationPayloadHash:hash,planningContext:JSON.parse(JSON.stringify({executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}))},include});
      await tx.campaignChange.create({data:{campaignId:after.id,source:'COPIED_SETUP',reason:'نسخه تازه برای ویرایش؛ اجرای قبلی منتقل نشده است',data:{sourceCampaignId:id}}});return after;
    });
  }
  async reuse(id:string,input:unknown){
    const parsed=z.object({name:CreateCampaignSchema.shape.name,startDate:CreateCampaignSchema.shape.startDate.unwrap(),mode:z.enum(['plan','setup']),includeLearnings:z.boolean().default(false),expectedUpdatedAt:z.string().datetime(),key:z.string().uuid()}).strict().safeParse(input);
    if(!parsed.success)throw new BadRequestException('نام، تاریخ شروع و روش استفاده مجدد را بررسی کن.');
    const p=parsed.data;
    const hash=createHash('sha256').update(JSON.stringify({sourceCampaignId:id,...p,key:undefined})).digest('hex');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const source=await tx.campaign.findUnique({where:{id}});
      if(!source)throw new NotFoundException('کمپین پیدا نشد.');
      const previous=await tx.campaign.findUnique({where:{creationKey:p.key},include});
      if(previous){if(previous.ownerId!==source.ownerId||previous.creationPayloadHash!==hash)throw new ConflictException('این درخواست قبلاً با اطلاعات دیگری ثبت شده است.');return previous;}
      if(source.updatedAt.toISOString()!==p.expectedUpdatedAt)throw new ConflictException('کمپین اصلی تغییر کرده است؛ صفحه را تازه کن و دوباره تلاش کن.');
      if(p.mode==='plan'){
        if(!source.aiPlan)throw new BadRequestException('این کمپین هنوز طرح ذخیره‌شده ندارد؛ کپی اطلاعات را انتخاب کن.');
        try{validateStoredPlan(source.aiPlan,source.duration,source.maxContentPerDay);}catch{throw new BadRequestException('طرح ذخیره‌شده برای استفاده مجدد معتبر نیست؛ از کپی اطلاعات و ساخت طرح تازه استفاده کن.');}
      }
      const context=(source.planningContext??{}) as Record<string,unknown>;
      const completion=source.completion as {learnings?:string[]}|null;
      const learnings=p.includeLearnings&&source.status==='COMPLETED'?completion?.learnings??[]:[];
      const fields=CreateCampaignSchema.safeParse({
        name:p.name,businessType:source.businessType,campaignType:source.campaignType,product:source.product,
        audience:source.audience??undefined,problem:source.problem??undefined,outcome:source.outcome??undefined,
        duration:source.duration,target:source.target??undefined,maxContentPerDay:source.maxContentPerDay,
        offer:source.offer,salesPath:source.salesPath,startDate:p.startDate,
        executionProfile:context.executionProfile,methodRequired:context.methodRequired,objections:context.objections,proofAssets:context.proofAssets,availableContentFormats:context.availableContentFormats,
        conversionPath:Object.prototype.hasOwnProperty.call(context,'conversionPath')?context.conversionPath:source.salesPath,
        previousLearnings:learnings.length?[...new Set([...(Array.isArray(context.previousLearnings)?context.previousLearnings:[]),...learnings])]:context.previousLearnings,
      });
      if(!fields.success)throw new BadRequestException('اطلاعات کمپین اصلی برای کپی معتبر نیست؛ اطلاعات پایه را بررسی کن.');
      const {executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=fields.data;
      const result=await tx.campaign.create({data:{...base,ownerId:source.ownerId,status:'DRAFT',startDate:new Date(startDate!+'T12:00:00.000Z'),creationKey:p.key,creationPayloadHash:hash,
        planningContext:JSON.parse(JSON.stringify({executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings})),
        ...(p.mode==='plan'?{aiPlan:source.aiPlan as Prisma.InputJsonValue,planningContext:JSON.parse(JSON.stringify({...context,previousLearnings,methodState:(context.methodState as any)?.accepted?{accepted:(context.methodState as any).accepted,reused:true}:undefined}))}:{}),
      },include});
      await tx.campaignChange.create({data:{campaignId:result.id,source:'REUSED_CAMPAIGN',reason:p.mode==='plan'?'استفاده مجدد از اطلاعات و طرح ذخیره‌شده؛ منتظر تأیید اجرا':'استفاده مجدد از اطلاعات برای طرح تازه',data:{sourceCampaignId:id,mode:p.mode,includeLearnings:p.includeLearnings}}});
      return result;
    });
  }
  async setup(id:string,input:unknown){
    const p=z.object({expectedUpdatedAt:z.string().datetime(),fields:CreateCampaignSchema}).strict().safeParse(input);if(!p.success)throw new BadRequestException('اطلاعات پایه معتبر لازم است.');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
      if(c.status!=='DRAFT'||c.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('اطلاعات تغییر کرده یا طرح تأیید شده است؛ دوباره بخوان.');
      const {executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=p.data.fields;
      const planningContext=JSON.parse(JSON.stringify({executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}));
      const previousState=(c.planningContext as any)?.methodState;
      if(previousState)planningContext.methodState=methodHash(c)===methodHash({...c,...base,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):null,planningContext})?previousState:{sourceHash:previousState.sourceHash,report:previousState.report};
      const after=await tx.campaign.update({where:{id},data:{...base,ownerId:c.ownerId,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):null,planningContext,aiPlan:Prisma.DbNull},include});
      await tx.campaignChange.create({data:{campaignId:id,source:'MANUAL_SETUP',reason:'تغییر اطلاعات واقعی؛ طرح قبلی نیاز به ساخت مجدد دارد',data:JSON.parse(JSON.stringify({before:c,after}))}});return after;
    });
  }
  async create(input: unknown,creationKey?:string,userId?:string) {
    const parsed = CreateCampaignSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if(creationKey&&!/^[a-zA-Z0-9-]{16,100}$/.test(creationKey))throw new BadRequestException('شناسه ثبت معتبر نیست.');
    const creationPayloadHash=createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    const existing=creationKey?await this.db.campaign.findUnique({where:{creationKey},include}):null;
    if(existing){if((userId&&existing.ownerId!==userId)||existing.creationPayloadHash!==creationPayloadHash)throw new ConflictException('این ثبت قبلاً انجام شده و اطلاعات جدید متفاوت است؛ فهرست کمپین‌ها را بررسی کن.');return existing;}
    const {executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=parsed.data;
    const planningContext = JSON.parse(JSON.stringify({executionProfile,methodRequired,objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}));
    try{return await this.db.campaign.create({include,data:{...base,ownerId:userId,creationKey,creationPayloadHash:creationKey?creationPayloadHash:undefined,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):undefined,planningContext}});}catch(e){
      if(creationKey&&e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002'){const row=await this.db.campaign.findUnique({where:{creationKey},include});if(row?.creationPayloadHash===creationPayloadHash&&(!userId||row.ownerId===userId))return row;}
      throw e;
    }
  }
  async get(id: string,userId?:string) {
    const campaign = await this.db.campaign.findFirst({ where: { id, ...(userId?{ownerId:userId}:{}) }, include });
    if (!campaign) throw new NotFoundException('کمپین پیدا نشد');
    return {...campaign,context:normalizedContext(campaign)};
  }
  async completeTask(id: string) {
    return this.db.$transaction(async tx => {
      const task = await tx.task.findUnique({where:{id},include:{day:true}});
      if (!task) throw new NotFoundException('کار پیدا نشد');
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${task.day.campaignId} FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({where:{id:task.day.campaignId}});
      if(campaign?.status!=='ACTIVE') throw new ConflictException('ابتدا طرح کمپین را تأیید کن؛ اجرای کارها هنوز شروع نشده است.');
      const current = await tx.task.findUnique({where:{id}});
      if (!current || current.archived) throw new ConflictException('این کار مربوط به برنامه قبلی است؛ صفحه را تازه کن.');
      if(current.status==='SKIPPED')throw new ConflictException('کار ردشده را ابتدا به برنامه برگردان.');
      return tx.task.update({ where: { id }, data: { status: 'DONE' } });
    });
  }
}

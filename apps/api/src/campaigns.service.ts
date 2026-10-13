import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateCampaignSchema } from './campaigns.dto';
import { normalizedContext } from './campaign-context';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
const include = {preparationTasks:{orderBy:{position:'asc' as const}},days: { include: { result:true, tasks: { where: { archived: false },orderBy:[{position:'asc' as const},{id:'asc' as const}] } }, orderBy: { dayNumber: 'asc' as const } } };
@Injectable()
export class CampaignsService {
  constructor(private db: PrismaService) {}
  list() { return this.db.campaign.findMany({ include, orderBy: { updatedAt: 'desc' } }); }
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
      if(previous){if(previous.creationPayloadHash!==hash)throw new ConflictException('نسخه تازه قبلاً با اطلاعات متفاوت ثبت شده؛ فهرست را بررسی کن.');return previous;}
      if(c.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('اطلاعات کمپین تغییر کرده؛ دوباره بخوان.');
      const {objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=p.data.fields;
      const after=await tx.campaign.create({data:{...base,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):null,creationKey:p.data.key,creationPayloadHash:hash,planningContext:JSON.parse(JSON.stringify({objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}))},include});
      await tx.campaignChange.create({data:{campaignId:after.id,source:'COPIED_SETUP',reason:'نسخه تازه برای ویرایش؛ اجرای قبلی منتقل نشده است',data:{sourceCampaignId:id}}});return after;
    });
  }
  async setup(id:string,input:unknown){
    const p=z.object({expectedUpdatedAt:z.string().datetime(),fields:CreateCampaignSchema}).strict().safeParse(input);if(!p.success)throw new BadRequestException('اطلاعات پایه معتبر لازم است.');
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
      const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
      if(c.status!=='DRAFT'||c.updatedAt.toISOString()!==p.data.expectedUpdatedAt)throw new ConflictException('اطلاعات تغییر کرده یا طرح تأیید شده است؛ دوباره بخوان.');
      const {objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=p.data.fields;
      const planningContext=JSON.parse(JSON.stringify({objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}));
      const after=await tx.campaign.update({where:{id},data:{...base,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):null,planningContext,aiPlan:Prisma.DbNull},include});
      await tx.campaignChange.create({data:{campaignId:id,source:'MANUAL_SETUP',reason:'تغییر اطلاعات واقعی؛ طرح قبلی نیاز به ساخت مجدد دارد',data:JSON.parse(JSON.stringify({before:c,after}))}});return after;
    });
  }
  async create(input: unknown,creationKey?:string) {
    const parsed = CreateCampaignSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if(creationKey&&!/^[a-zA-Z0-9-]{16,100}$/.test(creationKey))throw new BadRequestException('شناسه ثبت معتبر نیست.');
    const creationPayloadHash=createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    const existing=creationKey?await this.db.campaign.findUnique({where:{creationKey},include}):null;
    if(existing){if(existing.creationPayloadHash!==creationPayloadHash)throw new ConflictException('این ثبت قبلاً انجام شده و اطلاعات جدید متفاوت است؛ فهرست کمپین‌ها را بررسی کن.');return existing;}
    const {objections,proofAssets,availableContentFormats,conversionPath,previousLearnings,startDate,...base}=parsed.data;
    const planningContext = JSON.parse(JSON.stringify({objections,proofAssets,availableContentFormats,conversionPath,previousLearnings}));
    try{return await this.db.campaign.create({include,data:{...base,creationKey,creationPayloadHash:creationKey?creationPayloadHash:undefined,startDate:startDate?new Date(startDate+'T12:00:00.000Z'):undefined,planningContext}});}catch(e){
      if(creationKey&&e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002'){const row=await this.db.campaign.findUnique({where:{creationKey},include});if(row?.creationPayloadHash===creationPayloadHash)return row;}
      throw e;
    }
  }
  async get(id: string) {
    const campaign = await this.db.campaign.findUnique({ where: { id }, include });
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

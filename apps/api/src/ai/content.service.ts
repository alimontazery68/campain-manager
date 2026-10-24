import {contentGuide,guideVersion,guideDigest} from '../campaign-guides';
import { acceptedMethod } from './campaign-methods';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AI_PROVIDER, AiProvider } from './provider';
import { buildContentPrompt, revisionBrief, validateRevision, ContentActionSchema, ContentOutputSchema, SaveContentSchema } from './content';
import { buildPlanningInput } from './planning-context';
@Injectable()
export class ContentService {
  private running = new Set<string>();
  constructor(private db:PrismaService,@Inject(AI_PROVIDER) private provider:AiProvider) {}
  private persist(id:string,campaignId:string,expectedContent:string|null,content:string,expectedUpdatedAt:Date,metadata?:Record<string,unknown>){
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;
      const campaign=await tx.campaign.findUnique({where:{id:campaignId}});
      if(campaign?.status!=='ACTIVE')throw new ConflictException('کمپین دیگر فعال نیست؛ متن نهایی تغییر نکرد.');
      return tx.task.updateMany({where:{id,archived:false,locked:false,status:'PENDING',updatedAt:expectedUpdatedAt,content:expectedContent},data:{content,...(metadata?{metadata:JSON.parse(JSON.stringify(metadata))}:{})}});
    });
  }
  private async task(id:string) {
    const task=await this.db.task.findUnique({where:{id},include:{day:{include:{campaign:true}}}});
    if(!task) throw new NotFoundException('کار پیدا نشد.');
    if(task.archived) throw new ConflictException('این کار مربوط به برنامه قبلی است.');
    if(task.locked)throw new ConflictException('کار قفل شده است؛ برای تغییر متن ابتدا قفل را باز کن.');
    if(task.status!=='PENDING')throw new ConflictException('متن کار انجام‌شده یا ردشده فقط قابل مشاهده است.');
    if(task.type!=='CONTENT') throw new BadRequestException('این کار محتوایی نیست.');
    if(task.day.campaign.status!=='ACTIVE') throw new ConflictException('ابتدا طرح کمپین را تأیید کن.');
    return task;
  }
  async generate(id:string,input:unknown) {
    const parsed=ContentActionSchema.safeParse(input ?? {});
    if(!parsed.success) throw new BadRequestException('درخواست ساخت محتوا معتبر نیست.');
    const {action,preferences}=parsed.data;
    const task=await this.task(id);
    if(action==='generate'&&task.content) return {id:task.id,content:task.content};
    if(['shorter','friendly','direct'].includes(action)&&!task.content) throw new BadRequestException('ابتدا محتوا را بساز یا متن خودت را ذخیره کن.');
    if(this.running.has(id)) throw new ConflictException('محتوا در حال ساخت است؛ کمی صبر کن.');
    this.running.add(id);
    try {
      const campaign=task.day.campaign;
      const selected=acceptedMethod(campaign);
      const context=buildPlanningInput(campaign);
      const raw=await this.provider.json(buildContentPrompt(action),{
        guideContext:contentGuide(acceptedMethod(campaign),(task.metadata as any)?.guideRef,(campaign.planningContext as any)?.guideOutput),action,currentContent:task.content,revisionBrief:revisionBrief(action,task.content),
        generationPreferences:{tone:preferences?.tone??'campaign',format:preferences?.format??'task',
          effectiveFormat:preferences?.format&&preferences.format!=='task'?({text:'متن',voice:'ویس',video:'ویدیو',image:'تصویر',demo:'دمو / نمایش محصول'} as const)[preferences.format]:task.format,
          instructions:preferences?.instructions??''},
        campaign:{selectedMethod:selected?{id:selected.id,title:selected.title,components:selected.components}:null,executionProfile:context.executionProfile,businessType:campaign.businessType,campaignType:campaign.campaignType,product:campaign.product,
          audience:campaign.audience,problem:campaign.problem,outcome:campaign.outcome,offer:campaign.offer,
          salesPath:context.conversionPath,proofAssets:context.proofAssets,objections:context.objections,availableContentFormats:context.availableContentFormats,approvedPlan:campaign.aiPlan?{strategy:(campaign.aiPlan as any).strategy,coreMessage:(campaign.aiPlan as any).coreMessage}:null},
        day:{dayNumber:task.day.dayNumber,phase:task.day.phase,mission:task.day.mission,objective:task.day.objective},
        guidance:task.day.guidance,effectiveDayIsAuthoritative:true,
        task:{title:task.title,format:task.format,why:task.why,cta:task.cta,objective:task.objective,requiredAsset:task.requiredAsset,metadata:task.metadata}
      });
      const result=ContentOutputSchema.safeParse(raw);
      if(!result.success) throw new ServiceUnavailableException('محتوای دریافت‌شده معتبر نبود؛ متن قبلی حفظ شد. دوباره تلاش کن.');
      try {validateRevision(action,task.content,result.data.content);} catch {
        throw new ServiceUnavailableException(action==='shorter'?'مدل متن را به‌اندازه کافی کوتاه نکرد؛ متن قبلی حفظ شد. دوباره تلاش کن.':'مدل تغییر معناداری در متن ایجاد نکرد؛ متن قبلی حفظ شد. دوباره تلاش کن.');
      }
      const saved=await this.persist(id,campaign.id,task.content,result.data.content,task.updatedAt,{...(task.metadata as any),guideOutput:{guideVersion,guideDigest,guideRef:(task.metadata as any)?.guideRef??null}});
      if(saved.count!==1) throw new ConflictException('متن در این فاصله تغییر کرده؛ متن جدیدتر حفظ شد. دوباره محتوا را باز کن.');
      return {id,content:result.data.content};
    } finally {this.running.delete(id);}
  }
  async save(id:string,input:unknown) {
    const parsed=SaveContentSchema.safeParse(input);
    if(!parsed.success) throw new BadRequestException('متن باید بین ۱ تا ۱۲۰۰۰ کاراکتر باشد.');
    const task=await this.task(id);
    const saved=await this.persist(id,task.day.campaignId,parsed.data.expectedContent,parsed.data.content,task.updatedAt);
    if(saved.count!==1) throw new ConflictException('نسخه دیگری از متن ذخیره شده است. متن خودت را کپی کن و نسخه ذخیره‌شده را دوباره باز کن.');
    return {id,content:parsed.data.content};
  }
}

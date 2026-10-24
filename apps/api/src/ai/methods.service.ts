import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AI_PROVIDER, AiProvider } from './provider';
import { acceptedMethod, methodAllowed, methodGuide, methodHash, methodInput, methodPrompt, MethodIdSchema, MethodOptionSchema, MethodReportSchema, normalizeQuestion, validateMethod } from './campaign-methods';
@Injectable()
export class MethodsService {
 private running=new Set<string>();
 constructor(private db:PrismaService,@Inject(AI_PROVIDER) private provider:AiProvider){}
 private async campaign(id:string){const c=await this.db.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');return c;}
 async get(id:string){const c=await this.campaign(id),state=(c.planningContext as any)?.methodState;const report=state?.sourceHash===methodHash(c)?state.report??null:null;return {sourceHash:methodHash(c),report:report?{...report,questions:report.questions.map(normalizeQuestion)}:null,accepted:acceptedMethod(c),stale:!!state&&!acceptedMethod(c)&&state.sourceHash!==methodHash(c)};}
 private async save(c:any,state:any){return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${c.id} FOR UPDATE`;const fresh=await tx.campaign.findUnique({where:{id:c.id}});if(!fresh||fresh.status!=='DRAFT'||fresh.updatedAt.getTime()!==c.updatedAt.getTime())throw new ConflictException('اطلاعات تغییر کرده؛ دوباره بررسی کن. پاسخ قدیمی ذخیره نشد.');await tx.campaign.update({where:{id:c.id},data:{planningContext:JSON.parse(JSON.stringify({...fresh.planningContext as any,methodRequired:true,methodState:state}))}});if(state.accepted)await tx.campaignChange.create({data:{campaignId:c.id,source:'METHOD_ACCEPTED',reason:'پذیرش روش اجرا پیش از ساخت طرح',data:JSON.parse(JSON.stringify({after:state.accepted}))}});});}
 async recommend(id:string){
  if(this.running.has(id))throw new ConflictException('پیشنهاد در حال ساخت است.');this.running.add(id);
  try{const c=await this.campaign(id);if(c.status!=='DRAFT'||c.aiPlan)throw new ConflictException('انتخاب روش پیش از ساخت طرح انجام می‌شود؛ ابتدا طرح پیش‌نویس را کنار بگذار.');
   const sourceHash=methodHash(c),state=(c.planningContext as any)?.methodState;if(state?.sourceHash===sourceHash&&state.report)return this.get(id);
   const raw=await this.provider.json(methodPrompt,{...methodInput(c),methodGuide,eligibleMethods:MethodIdSchema.options.filter(m=>methodAllowed(m,c))},{maxOutputTokens:2400});
   let report;try{report=MethodReportSchema.parse(raw);if((!report.primary&&(!report.questions.length||report.alternative))||(report.primary&&report.questions.length))throw new Error();if(report.primary)validateMethod(report.primary,c);if(report.alternative){validateMethod(report.alternative,c);if(report.alternative.id===report.primary?.id&&JSON.stringify(report.alternative.components)===JSON.stringify(report.primary.components))throw new Error();}}catch{throw new ServiceUnavailableException('پیشنهاد معتبر نبود؛ اطلاعات قبلی حفظ شد. امکانات و اطلاعات را بررسی کن و دوباره تلاش کن.');}
   report.questions=report.questions.map(normalizeQuestion);
   if(new Set(report.questions.map(q=>normalizeQuestion(q).field)).size!==report.questions.length)throw new ServiceUnavailableException('سؤال‌های تکراری دریافت شد؛ اطلاعات قبلی محفوظ است.');
   await this.save(c,{sourceHash,report});return this.get(id);
  }finally{this.running.delete(id);}
 }
 async answers(id:string,input:unknown){
  const value=z.string().trim().min(1).max(3000),capability=z.enum(['yes','no','unknown']);
  const p=z.object({sourceHash:z.string().length(64),answers:z.object({audience:value.optional(),problem:value.optional(),price:value.max(200).optional(),privateReplies:capability.optional(),calls:capability.optional(),onlineSession:capability.optional(),familiarity:z.enum(['unknown','cold','aware','customer']).optional(),formats:z.array(value).max(20).nullable().optional(),constraints:value.max(2000).optional()}).strict()}).strict().safeParse(input);
  if(!p.success||!Object.keys(p.data.answers).length)throw new BadRequestException('پاسخ‌های معتبر را وارد کن.');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
   const c=await tx.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');
   const context=(c.planningContext??{}) as any,state=context.methodState;
   if(c.status!=='DRAFT'||c.aiPlan||methodHash(c)!==p.data.sourceHash||state?.sourceHash!==p.data.sourceHash)throw new ConflictException('اطلاعات تغییر کرده؛ سؤال‌ها را دوباره بخوان.');
   const allowed=state.report?.questions.map((q:any)=>normalizeQuestion(q).field)??[];
   if(Object.keys(p.data.answers).some(key=>!allowed.includes(key)))throw new BadRequestException('فقط پاسخ سؤال‌های همین پیشنهاد قابل ذخیره است.');
   const {audience,problem,price,formats,...profile}=p.data.answers;
   const nextContext={...context,executionProfile:{...context.executionProfile,...profile},...(formats!==undefined?{availableContentFormats:formats}:{}),methodQuestionsAnswered:[...new Set([...(context.methodQuestionsAnswered??[]),...Object.keys(p.data.answers)])].sort(),methodState:{sourceHash:state.sourceHash}};
   if(methodHash({...c,...(audience!==undefined?{audience}:{}),...(problem!==undefined?{problem}:{}),...(price!==undefined?{offer:{...(c.offer as any),regularPrice:price}}:{}),planningContext:nextContext})===methodHash(c))nextContext.methodState=state;
   await tx.campaign.update({where:{id},data:{...(audience!==undefined?{audience}:{}),...(problem!==undefined?{problem}:{}),...(price!==undefined?{offer:{...(c.offer as any),regularPrice:price}}:{}),planningContext:JSON.parse(JSON.stringify(nextContext))}});
   await tx.campaignChange.create({data:{campaignId:id,source:'METHOD_ANSWERS',reason:'تکمیل اطلاعات تعیین‌کننده برای پیشنهاد روش',data:JSON.parse(JSON.stringify({fields:Object.keys(p.data.answers)}))}});
   return {saved:true};
  });
 }
 async accept(id:string,input:unknown){
  const p=z.object({sourceHash:z.string().length(64),choice:z.enum(['primary','alternative','manual']),method:MethodIdSchema.optional(),components:z.array(MethodIdSchema.exclude(['hybrid'])).max(3).optional()}).strict().safeParse(input);if(!p.success)throw new BadRequestException('انتخاب روش معتبر نیست.');
  const c=await this.campaign(id);if(c.status!=='DRAFT'||c.aiPlan)throw new ConflictException('روش فقط پیش از ساخت طرح قابل انتخاب است.');if(methodHash(c)!==p.data.sourceHash)throw new ConflictException('اطلاعات تغییر کرده؛ پیشنهاد را دوباره بررسی کن.');
  const state=(c.planningContext as any)?.methodState;let option;
  if(p.data.choice==='manual'&&p.data.method){const guide=methodGuide[p.data.method];option={id:p.data.method,components:p.data.components??[],title:guide.title,journey:guide.stages.join(' ← '),reasons:['انتخاب مستقیم کاربر'],preparation:guide.requirements,assumptions:[],limitations:['تناسب این روش را با امکانات واقعی خود بررسی کن.']};}
  else option=state?.sourceHash===p.data.sourceHash?state.report?.[p.data.choice]:null;
  try{option=validateMethod(MethodOptionSchema.parse(option),c);}catch{throw new BadRequestException('این روش با امکانات تأییدشده سازگار نیست؛ اطلاعات را اصلاح کن.');}
  await this.save(c,{sourceHash:p.data.sourceHash,report:state?.sourceHash===p.data.sourceHash?state.report:undefined,accepted:option});return this.get(id);
 }
}

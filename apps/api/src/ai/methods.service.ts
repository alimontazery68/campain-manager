import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AI_PROVIDER, AiProvider } from './provider';
import { acceptedMethod, methodAllowed, methodGuide, methodHash, methodInput, methodPrompt, MethodIdSchema, MethodOptionSchema, MethodReportSchema, validateMethod } from './campaign-methods';
@Injectable()
export class MethodsService {
 private running=new Set<string>();
 constructor(private db:PrismaService,@Inject(AI_PROVIDER) private provider:AiProvider){}
 private async campaign(id:string){const c=await this.db.campaign.findUnique({where:{id}});if(!c)throw new NotFoundException('کمپین پیدا نشد.');return c;}
 async get(id:string){const c=await this.campaign(id),state=(c.planningContext as any)?.methodState;return {sourceHash:methodHash(c),report:state?.sourceHash===methodHash(c)?state.report??null:null,accepted:acceptedMethod(c),stale:!!state&&!acceptedMethod(c)&&state.sourceHash!==methodHash(c)};}
 private async save(c:any,state:any){return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${c.id} FOR UPDATE`;const fresh=await tx.campaign.findUnique({where:{id:c.id}});if(!fresh||fresh.status!=='DRAFT'||fresh.updatedAt.getTime()!==c.updatedAt.getTime())throw new ConflictException('اطلاعات تغییر کرده؛ دوباره بررسی کن. پاسخ قدیمی ذخیره نشد.');await tx.campaign.update({where:{id:c.id},data:{planningContext:JSON.parse(JSON.stringify({...fresh.planningContext as any,methodRequired:true,methodState:state}))}});if(state.accepted)await tx.campaignChange.create({data:{campaignId:c.id,source:'METHOD_ACCEPTED',reason:'پذیرش روش اجرا پیش از ساخت طرح',data:JSON.parse(JSON.stringify({after:state.accepted}))}});});}
 async recommend(id:string){
  if(this.running.has(id))throw new ConflictException('پیشنهاد در حال ساخت است.');this.running.add(id);
  try{const c=await this.campaign(id);if(c.status!=='DRAFT'||c.aiPlan)throw new ConflictException('انتخاب روش پیش از ساخت طرح انجام می‌شود؛ ابتدا طرح پیش‌نویس را کنار بگذار.');
   const sourceHash=methodHash(c),state=(c.planningContext as any)?.methodState;if(state?.sourceHash===sourceHash&&state.report)return this.get(id);
   const raw=await this.provider.json(methodPrompt,{...methodInput(c),methodGuide,eligibleMethods:MethodIdSchema.options.filter(m=>methodAllowed(m,c))});
   let report;try{report=MethodReportSchema.parse(raw);if((!report.primary&&(!report.questions.length||report.alternative))||(report.primary&&report.questions.length))throw new Error();if(report.primary)validateMethod(report.primary,c);if(report.alternative){validateMethod(report.alternative,c);if(report.alternative.id===report.primary?.id&&JSON.stringify(report.alternative.components)===JSON.stringify(report.primary.components))throw new Error();}}catch{throw new ServiceUnavailableException('پیشنهاد معتبر نبود؛ اطلاعات قبلی حفظ شد. امکانات و اطلاعات را بررسی کن و دوباره تلاش کن.');}
   await this.save(c,{sourceHash,report});return this.get(id);
  }finally{this.running.delete(id);}
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

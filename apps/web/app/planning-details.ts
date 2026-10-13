export type Knowledge='unknown'|'none'|'known';
export type ProofDraft={type:string;description:string;count:string};
export type PlanningDetails={mode:'quick'|'detailed';objectionsStatus:Knowledge;objections:string;proofStatus:Knowledge;proofs:ProofDraft[];formatsStatus:Knowledge;formats:string[];maxContentPerDay:number};
export const emptyDetails:PlanningDetails={mode:'quick',objectionsStatus:'unknown',objections:'',proofStatus:'unknown',proofs:[],formatsStatus:'unknown',formats:[],maxContentPerDay:1};
export function normalizeNumber(value:string){return value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();}
export function buildDetailedInput(d:PlanningDetails){
 if(!Number.isInteger(d.maxContentPerDay)||d.maxContentPerDay<1||d.maxContentPerDay>4)throw Error('تعداد محتوای روزانه باید بین ۱ تا ۴ باشد.');
 if(d.mode==='quick')return {maxContentPerDay:d.maxContentPerDay};
 const objections=d.objectionsStatus==='unknown'?null:d.objectionsStatus==='none'?[]:d.objections.split('\n').map(s=>s.trim()).filter(Boolean);
 if(objections&&(objections.length>30||objections.some(s=>s.length>3000)))throw Error('حداکثر ۳۰ تردید، هرکدام تا ۳۰۰۰ کاراکتر وارد کن.');
 if(d.objectionsStatus==='known'&&!objections?.length)throw Error('تردید مشتری را بنویس یا «نمی‌دانم» را انتخاب کن.');
 const proofAssets=d.proofStatus==='unknown'?null:d.proofStatus==='none'?[]:d.proofs.map(p=>{
  const type=p.type.trim(),description=p.description.trim(),count=normalizeNumber(p.count);
  if(!type||!description||type.length>3000||description.length>3000)throw Error('برای هر شاهد، نوع و توضیح واقعی بنویس؛ حداکثر ۳۰۰۰ کاراکتر.');
  if(count&&(!/^\d+$/.test(count)||!Number.isSafeInteger(Number(count))))throw Error('تعداد شواهد باید عدد صحیح نامنفی معتبر باشد یا خالی بماند.');
  return {type,description,...(count?{count:Number(count)}:{})};
 });
 if(proofAssets&&proofAssets.length>30)throw Error('حداکثر ۳۰ شاهد ثبت کن.');
 if(d.proofStatus==='known'&&!proofAssets?.length)throw Error('حداقل یک شاهد واقعی اضافه کن یا «ندارم» را انتخاب کن.');
 const availableContentFormats=d.formatsStatus==='unknown'?null:d.formatsStatus==='none'?[]:[...new Set(d.formats.map(s=>s.trim()).filter(Boolean))];
 if(d.formatsStatus==='known'&&!availableContentFormats?.length)throw Error('حداقل یک قالب قابل اجرا انتخاب کن یا «نمی‌دانم» را انتخاب کن.');
 if(availableContentFormats&&(availableContentFormats.length>20||availableContentFormats.some(s=>s.length>3000)))throw Error('قالب‌های محتوا معتبر نیستند.');
 return {maxContentPerDay:d.maxContentPerDay,objections,proofAssets,availableContentFormats};
}

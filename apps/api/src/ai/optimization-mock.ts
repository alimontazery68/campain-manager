import { OptimizationSchema } from './optimization';
export function mockOptimization(input:any){
 return OptimizationSchema.parse({schemaVersion:2,summary:'بررسی آزمایشی؛ پاسخ واقعی مدل نیست.',facts:(input.results??[]).slice(0,10).map((r:any)=>({text:`برای روز ${r.dayNumber} یک نتیجه با وضعیت ${r.rating} ثبت شده است.`})),calculations:input.calculations??[],signals:[],hypotheses:[],recommendation:{type:'NO_CHANGE',summary:'در حالت آزمایشی برنامه فعلی بدون تغییر باقی می‌ماند.',reason:'این خروجی صرفاً برای آزمون جریان رابط و ذخیره‌سازی است.',proposedChanges:[]},missingInformation:[],limitations:['حالت آزمایشی فعال است؛ این گزارش ارزیابی واقعی عملکرد کمپین نیست.']});
}

const fieldLabels: Record<string,string> = {
  name:'نام کمپین', businessType:'نوع کسب‌وکار', campaignType:'هدف کمپین', product:'توضیح محصول',
  audience:'مخاطب', problem:'مشکل مخاطب', outcome:'نتیجه مطلوب', duration:'مدت کمپین', target:'هدف عددی',
  offer:'پیشنهاد', salesPath:'مسیر اقدام مخاطب', maxContentPerDay:'تعداد محتوای روزانه',
  objections:'اعتراض‌ها', proofAssets:'شواهد', availableContentFormats:'قالب‌های محتوا',
  conversionPath:'مسیر تبدیل', previousLearnings:'یادگیری‌های قبلی'
};
export function responseError(status:number,body:unknown):string {
  const data = body && typeof body==='object' ? body as Record<string,unknown> : {};
  const message=data.message;
  if(typeof message==='string') return message;
  if(status===400 && message && typeof message==='object') {
    const fields=(message as Record<string,unknown>).fieldErrors;
    if(fields && typeof fields==='object') {
      const names=Object.entries(fields).filter(([,errors])=>Array.isArray(errors)&&errors.length>0).map(([name])=>fieldLabels[name]||'اطلاعات فرم');
      if(names.length) return 'این موارد را بررسی کن: '+names.join('، ')+'. ممکن است مقدار یا طول متن خارج از محدوده باشد. اطلاعاتت حفظ شده است.';
    }
  }
  if(status===400) return 'اطلاعات واردشده معتبر نیست؛ موارد فرم را بررسی کن. اطلاعاتت حفظ شده است.';
  if(status===502 || status===504) return 'بک‌اند در دسترس نیست یا پاسخ آن دیر رسید. اجرای NestJS را بررسی و دوباره تلاش کن.';
  if(status>=500) return 'سرور هنگام انجام درخواست خطا داد. اطلاعاتت حفظ شده؛ دوباره تلاش کن.';
  return 'درخواست انجام نشد. اطلاعاتت حفظ شده است.';
}
export async function request<T>(path:string,init?:RequestInit):Promise<T> {
  let response:Response;
  try {
    response=await fetch('/api/'+path,{...init,cache:'no-store',headers:{'Content-Type':'application/json',...init?.headers}});
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد. اتصال و اجرای پروژه را بررسی کن؛ اطلاعاتت حفظ شده است.');
  }
  const body:unknown=await response.json().catch(()=>undefined);
  if(!response.ok) throw new Error(responseError(response.status,body));
  if(body===undefined) throw new Error('پاسخ سرور قابل خواندن نبود؛ دوباره تلاش کن.');
  return body as T;
}

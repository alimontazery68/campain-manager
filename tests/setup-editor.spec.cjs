const {test,expect}=require('@playwright/test');
for(const status of ['DRAFT','ACTIVE'])test(`compact setup editor saves Persian dates and preserves context for ${status}`,async({page})=>{
 const campaign={id:'source',name:'کمپین اصلی',status,businessType:'آموزش',campaignType:'فروش',product:'دوره',audience:'مخاطب',duration:2,days:[],preparationTasks:[],maxContentPerDay:1,updatedAt:'2026-10-15T00:00:00Z',startDate:'2026-11-01T12:00:00Z',offer:{kind:'پیشنهاد',details:'توضیح',regularPrice:'۱۰۰',bonus:'هدیه واقعی'},salesPath:{action:'پیام',details:'پشتیبانی'},planningContext:{conversionPath:null,objections:[],proofAssets:null,availableContentFormats:['متن']}};
 let copied;const mutations=[];
 await page.route('**/api/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'test'}}});
  if(path==='/api/campaigns')return route.fulfill({json:[campaign]});
  if(path.endsWith('/preparation'))return route.fulfill({json:{status,initialized:true,items:[]}});
  if(req.method()!=='GET'&&(path.endsWith('/setup')||path.endsWith('/copy'))){const body=req.postDataJSON();mutations.push({method:req.method(),body});if(status==='DRAFT'){Object.assign(campaign,body.fields);return route.fulfill({json:campaign});}copied={...campaign,...body.fields,id:'copy',status:'DRAFT'};return route.fulfill({json:copied});}
  if(path==='/api/campaigns/source')return route.fulfill({json:campaign});
  if(path==='/api/campaigns/copy')return route.fulfill({json:copied});
  return route.fulfill({json:null});
 });
 await page.goto('/');await page.locator('.campaign-card').click();await page.getByRole('tab',{name:'اطلاعات',exact:true}).click();
 const editor=page.locator('.setup-editor');await editor.locator(':scope>summary').click();
 await expect(editor.locator('.setup-section')).toHaveCount(4);
 const date=editor.getByLabel('تاریخ شروع (شمسی، اختیاری)',{exact:true});
 await expect(date).toHaveValue(status==='DRAFT'?'1405/08/10':'');
 await editor.getByRole('checkbox').check();
 const save=editor.getByRole('button',{name:status==='DRAFT'?'ذخیره اطلاعات واقعی':'ذخیره نسخه تازه برای طرح جدید',exact:true});
 await date.fill('');await date.blur();await expect(save).toBeEnabled();await expect(date).toHaveAttribute('aria-invalid','false');
 await date.fill('۱۴۰۴/۱۲/۳۰');await expect(save).toBeDisabled();
 await date.fill('۱۴۰۵/۰۸/۱۱');await expect(save).toBeEnabled();
 await editor.getByRole('textbox',{name:'نام',exact:true}).fill('نام اصلاح‌شده');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await save.click();await expect.poll(()=>mutations.length).toBe(1);
 expect(mutations[0].method).toBe(status==='DRAFT'?'PATCH':'POST');
 expect(mutations[0].body.fields).toMatchObject({name:'نام اصلاح‌شده',startDate:'2026-11-02',conversionPath:null,objections:[],proofAssets:null,availableContentFormats:['متن'],offer:{regularPrice:'۱۰۰',bonus:'هدیه واقعی'}});
});

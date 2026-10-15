const {test,expect}=require('@playwright/test');
const {fixture}=require('../scripts/planning-fixtures.cjs');
for(const mode of ['plan','setup'])test(`reuse campaign in ${mode} mode without automatic AI`,async({page})=>{
 const source={id:'source',name:'دوره هوش مصنوعی',status:'COMPLETED',product:'دوره کاربردی',duration:2,days:[],aiPlan:fixture(),maxContentPerDay:1,preparationTasks:[],updatedAt:'2026-10-15T00:00:00Z',completion:{learnings:['زمان تمرین مهم است']}};
 const campaigns=[source],posts=[];
 await page.route('**/api/**',r=>{
  const req=r.request(),path=new URL(req.url()).pathname;
  if(path==='/api/auth/session')return r.fulfill({json:{user:{id:'test'}}});
  if(path==='/api/campaigns')return r.fulfill({json:campaigns});
  if(req.method()!=='GET')posts.push({path,body:req.postDataJSON()});
  if(path==='/api/campaigns/source/reuse'){
   const data=req.postDataJSON();const c={...source,id:'new-copy',name:data.name,status:'DRAFT',startDate:data.startDate,aiPlan:data.mode==='plan'?source.aiPlan:null,completion:null};campaigns.unshift(c);return r.fulfill({json:c});
  }
  return r.fulfill({json:null});
 });
 await page.goto('/');await page.getByRole('button',{name:'کمپین‌های من',exact:true}).click();
 await page.getByRole('button',{name:'استفاده مجدد از '+source.name,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'استفاده مجدد از کمپین'});
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox')).toHaveValue('plan');
 await dialog.getByLabel('نام کمپین جدید').fill('اجرای دوم دوره');await dialog.getByLabel('تاریخ شروع جدید').fill('۱۴۰۵/۰۸/۱۰');
 await dialog.getByLabel('تاریخ شروع جدید').fill('۱۴۰۵/۰۷/۳۱');
 await expect(dialog.getByRole('button',{name:'ساخت پیش‌نویس جدید',exact:true})).toBeDisabled();
 await dialog.getByLabel('تاریخ شروع جدید').fill('۱۴۰۵/۰۸/۱۰');
 await dialog.getByText('انتخاب از تقویم شمسی',{exact:true}).click();
 await dialog.getByRole('button',{name:'10 آبان 1405',exact:true}).click();
 await dialog.getByRole('combobox').selectOption(mode);
 await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'ساخت پیش‌نویس جدید',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator('.workspace-heading h2')).toHaveText('اجرای دوم دوره');
 await expect(page.getByRole('button',{name:mode==='plan'?'تأیید و ساخت برنامه اجرا':'ساخت طرح کمپین',exact:true})).toBeVisible();
 expect(posts).toHaveLength(1);expect(posts[0]).toMatchObject({path:'/api/campaigns/source/reuse',body:{mode,name:'اجرای دوم دوره',startDate:'2026-11-01',includeLearnings:true,expectedUpdatedAt:source.updatedAt}});
 await page.getByRole('button',{name:'کمپین‌های من',exact:true}).click();
 await expect(page.locator('.campaign-card')).toHaveCount(2);
 expect(source.status).toBe('COMPLETED');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

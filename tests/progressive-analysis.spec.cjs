const {test,expect}=require('@playwright/test');
test('analysis exposes evidence and exact changes before explicit application',async({page})=>{
 const campaign={id:'analysis-test',name:'تحلیل نمونه',status:'ACTIVE',duration:2,product:'محصول',updatedAt:'2026-10-22T00:00:00Z',preparationTasks:[],days:[{id:'d1',dayNumber:1,date:new Date().toISOString(),mission:'شناخت نیاز',tasks:[{id:'t1',title:'پرسش اولیه',type:'CONTENT',status:'PENDING',position:0,cta:'پاسخ بده'}],result:{id:'r1',rating:'GOOD',views:null,leads:2,sales:0,revenue:null}}]};
 let analysis=null,generated=0,applied=0;
 const report={schemaVersion:2,summary:'برای تصمیم فروش هنوز داده کم است.',facts:[{text:'دو سرنخ ثبت شده؛ بازدید نامعلوم است.'}],calculations:[],signals:[],hypotheses:[{text:'ممکن است پرسش روشن‌تر پاسخ بیشتری بگیرد.',confidence:'LOW'}],recommendation:{type:'CHANGE',summary:'پرسش اولیه را روشن‌تر کن.',reason:'بازخورد واقعی',proposedChanges:[{operation:'EDIT',targetDayNumber:2,targetTaskId:'t1',task:{title:'پرسش درباره نیاز',cta:'نیازت را بنویس',why:'شناخت نیاز واقعی'},reason:'شفاف‌کردن سؤال'}]},missingInformation:['آمار بازدید ثبت نشده'],limitations:['داده برای نتیجه قطعی کافی نیست.']};
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname,m=route.request().method();let data=null;
  if(p.endsWith('/auth/session'))data={user:{id:'owner'}};
  else if(p==='/api/campaigns')data=[campaign];
  else if(p==='/api/campaigns/analysis-test')data=campaign;
  else if(p.endsWith('/analysis/decision')){expect(route.request().postDataJSON()).toEqual({action:'apply',sourceHash:'a'.repeat(64)});applied++;analysis.status='APPLIED';data=analysis;}
  else if(p.endsWith('/analysis')){if(m==='POST'){generated++;analysis={sourceHash:'a'.repeat(64),status:'PENDING',createdAt:new Date().toISOString(),report,beforeDays:campaign.days};}data=analysis;}
  else if(p.endsWith('/history'))data=[];
  await route.fulfill({json:data});
 });
 await page.goto('/');await page.getByRole('button',{name:'کمپین‌های من',exact:true}).first().click();await page.locator('.campaign-card').click();await page.locator('.campaign-journey').getByRole('button',{name:'نتایج و اصلاحات',exact:true}).click();
 expect(generated).toBe(0);await page.getByRole('button',{name:'بررسی و پیشنهاد برای ادامه کمپین',exact:true}).click();
 await expect(page.getByText(report.facts[0].text,{exact:true}).first()).toBeVisible();await expect(page.getByRole('cell',{name:'پرسش اولیه',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'پرسش درباره نیاز',exact:true})).toBeVisible();
 await expect(page.getByText(report.hypotheses[0].text,{exact:false})).not.toBeVisible();await page.getByText('مشاهده شواهد، محاسبات و برداشت‌ها',{exact:true}).click();await expect(page.getByText(report.hypotheses[0].text,{exact:false})).toBeVisible();
 expect(generated).toBe(1);expect(applied).toBe(0);await page.getByRole('button',{name:'اعمال پیشنهاد',exact:true}).click();await expect(page.getByRole('heading',{name:'اصلاحات اعمال شده',exact:true})).toBeVisible();expect(applied).toBe(1);expect(generated).toBe(1);
});

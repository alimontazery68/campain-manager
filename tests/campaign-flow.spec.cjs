const {test,expect}=require('@playwright/test');
const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {PlanningService}=require('../apps/api/dist/src/ai/planning.service');
const {ContentService}=require('../apps/api/dist/src/ai/content.service');
const {AnalysisService}=require('../apps/api/dist/src/ai/analysis.service');
const {LearningService}=require('../apps/api/dist/src/ai/learning.service');
const {fixture}=require('../scripts/planning-fixtures.cjs');
test('guided campaign lifecycle persists, protects work and reuses confirmed learnings without automatic AI',async({page,context},testInfo)=>{
 const db=new PrismaClient(),ids=[];let calls=0;const user=await require('./session.cjs').authenticate(context,db);
 const name='Browser test '+testInfo.project.name+' '+Date.now();
 const plan=fixture();plan.days[0].tasks[0].preparationTitles=[plan.preparation[0].title];
 const provider=(response)=>({json:async()=>{calls++;return response;}});
 const serviceRoute=async(route,handler)=>{try{const value=await handler();await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(value)});}catch(e){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:e.message})});}};
 await page.route('**/api/campaigns/*/plan',route=>route.request().method()==='POST'?serviceRoute(route,()=>new PlanningService(db,provider(plan)).generate(route.request().url().split('/').at(-2))):route.continue());
 await page.route('**/api/campaigns/tasks/*/content',route=>route.request().method()==='POST'?serviceRoute(route,()=>new ContentService(db,provider({content:'برای تمرین مکالمه، یک موضوع ساده انتخاب کن. چند جمله کوتاه درباره آن بگو و به مکث‌ها توجه کن. هدف شناخت مشکل واقعی است، نه وعده نتیجه قطعی. اگر درباره زمان تمرین سؤال داری، به پشتیبانی پیام بده.'})).generate(route.request().url().split('/').at(-2),route.request().postDataJSON())):route.continue());
 await page.route('**/api/campaigns/*/analysis',route=>route.request().method()==='POST'?serviceRoute(route,async()=>{const id=route.request().url().split('/').at(-2),days=await db.campaignDay.findMany({where:{campaignId:id},include:{tasks:true},orderBy:{dayNumber:'asc'}});return new AnalysisService(db,provider(require('../scripts/optimization-fixtures.cjs').review([{operation:'EDIT',targetDayNumber:days[1].dayNumber,targetTaskId:days[1].tasks.find(t=>t.type==='CONTENT').id,task:require('../scripts/optimization-fixtures.cjs').task('پاسخ به نگرانی زمان'),reason:'بازخورد وقت ندارم'}]))).generate(id);}):route.continue());
 await page.route('**/api/campaigns/*/learning',route=>route.request().method()==='POST'?serviceRoute(route,()=>new LearningService(db,provider({summary:'یادگیری محدود از بازخورد',limitations:['داده کم است.'],learnings:[{category:'OBJECTION',observation:'در بازخورد نگرانی درباره وقت مطرح شده.',evidence:[{dayNumber:1,fact:'وقت ندارم'}],confidence:'LOW',recommendation:'زمان تمرین را روشن توضیح بده.'}]})).generate(route.request().url().split('/').at(-2))):route.continue());
 async function createWizard(label,source){
  const previousLearnings=source?(await db.campaign.findUnique({where:{id:source}})).completion.learnings:undefined;
  const response=await page.request.post('/api/campaigns',{data:{name:label,businessType:'آموزش / دوره',campaignType:'فروش یک محصول',product:'دوره تمرین مکالمه',audience:'زبان‌آموزان',duration:2,offer:{kind:'پیشنهاد خاصی ندارم',details:''},salesPath:{action:'پیام به پشتیبانی',details:'توضیح شرایط و پرداخت'},previousLearnings}});
  expect(response.status()).toBe(201);const saved=await response.json();ids.push(saved.id);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:new RegExp(label)}).first().click();return saved;
 }

 try{
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'کمپین جدید',exact:true}).first()).toBeVisible();expect(calls).toBe(0);
  const c=await createWizard(name);expect(calls).toBe(0);
  await page.getByRole('button',{name:'ساخت طرح کمپین',exact:true}).click();await expect(page.getByRole('button',{name:'تأیید و ساخت برنامه اجرا',exact:true})).toBeEnabled();expect(calls).toBe(1);
  await page.getByRole('button',{name:'تأیید و ساخت برنامه اجرا',exact:true}).click();await expect(page.getByRole('heading',{name:'آماده‌سازی کمپین',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'آماده شد',exact:true}).first().click();await expect(page.getByRole('button',{name:'برگرداندن به آماده‌نشده',exact:true}).first()).toBeVisible();expect(calls).toBe(1);
  await page.getByRole('tab',{name:'محتوا',exact:true}).click();await expect(page.locator('.inline-content-editor').getByRole('heading',{name:'محتوای این کار'})).toBeVisible();await page.locator('.inline-content-editor').getByRole('button',{name:'ساخت محتوا',exact:true}).click();await expect(page.getByLabel('متن قابل ویرایش')).toHaveValue(/برای تمرین/);
  await expect.poll(async()=>calls).toBe(2);await page.getByRole('tab',{name:'نتایج',exact:true}).click();
  const result=page.locator('section').filter({has:page.getByRole('heading',{name:'این روز کمپین چطور بود؟',exact:true})}).last();
  await result.getByRole('button',{name:'خوب',exact:true}).click();await result.getByText('عددهای روز را هم دارم').click();await result.getByLabel('پیام / مشتری بالقوه').fill('15');await result.getByLabel('فروش / ثبت‌نام').fill('3');await result.getByLabel('افراد علاقه‌مندِ هنوز خریدنکرده').fill('12');await result.getByLabel('مهم‌ترین سؤال یا اعتراض مخاطب چه بود؟').fill('وقت ندارم');const savingResult=page.waitForResponse(r=>r.url().includes('/api/campaigns/days/')&&r.url().endsWith('/result')&&r.request().method()==='POST');await result.getByRole('button',{name:'ثبت نتیجه روز',exact:true}).click();const savedResult=await savingResult;expect(savedResult.status()).toBe(201);expect((await savedResult.json()).leads).toBe(15);await expect(result.getByText('نتیجه ذخیره شد. می‌توانی بعداً اصلاحش کنی.')).toBeVisible({timeout:15000});expect(calls).toBe(2);
  await page.getByRole('button',{name:'بررسی و پیشنهاد برای ادامه کمپین',exact:true}).click();await expect(page.getByRole('button',{name:'اعمال پیشنهاد',exact:true})).toBeEnabled();await page.getByRole('button',{name:'اعمال پیشنهاد',exact:true}).click();await expect(page.getByRole('heading',{name:'اصلاحات اعمال شده'})).toBeVisible();expect(calls).toBe(3);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:new RegExp(name)}).first().click();await expect(page.getByRole('heading',{name:'آماده‌سازی کمپین'})).toBeVisible();expect(calls).toBe(3);
  await page.getByRole('tab',{name:'نتایج',exact:true}).click();await page.getByRole('button',{name:'مشاهده جمع‌بندی',exact:true}).click();await page.getByLabel('پایان زودهنگام با وجود روزهای آینده را تأیید می‌کنم.').check();await page.getByLabel('ناقص بودن احتمالی نتایج را می‌پذیرم').check();await page.getByRole('button',{name:'پایان کمپین و ذخیره آموخته‌ها',exact:true}).click();await expect(page.getByRole('heading',{name:'جمع‌بندی کمپین پایان‌یافته'})).toBeVisible();expect(calls).toBe(3);
  await page.getByRole('button',{name:'ساخت جمع‌بندی هوشمند',exact:true}).click();await expect(page.getByRole('button',{name:'تأیید فقط نکته‌های منتخب',exact:true})).toBeVisible();await page.getByLabel('در بازخورد نگرانی درباره وقت مطرح شده.').check();await page.getByRole('button',{name:'تأیید فقط نکته‌های منتخب',exact:true}).click();await expect(page.getByText('نکته‌های منتخب ثبت شدند.')).toBeVisible();expect(calls).toBe(4);
  await page.getByRole('tab',{name:'اطلاعات',exact:true}).click();await page.getByText('سوابق تغییر برنامه',{exact:true}).click();await page.getByRole('button',{name:'خواندن سوابق؛ بدون AI',exact:true}).click();await expect(page.getByText(/پیشنهاد تأییدشده AI/)).toBeVisible();expect(calls).toBe(4);
  await page.getByRole('tab',{name:'نتایج',exact:true}).click();await page.getByText('گزارش و نسخه قابل دانلود',{exact:true}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'دانلود گزارش اکسل',exact:true}).click();const download=await downloadEvent;expect(download.suggestedFilename()).toBe('campaign-'+c.id+'.xlsx');const ExcelJS=require('../apps/web/node_modules/exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());expect(workbook.getWorksheet('خلاصه کمپین').getCell('B3').value).toBe('پایان‌یافته');expect(workbook.getWorksheet('تاریخچه').rowCount).toBeGreaterThan(1);expect(calls).toBe(4);
  await page.screenshot({path:testInfo.outputPath('completed.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const next=await createWizard(name+' next',c.id);expect(next.planningContext.previousLearnings.length).toBe(1);expect(calls).toBe(4);
 }finally{for(const id of ids)await db.campaign.delete({where:{id}});await db.user.delete({where:{id:user.id}});await db.$disconnect();}
});

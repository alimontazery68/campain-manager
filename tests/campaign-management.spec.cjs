const {test,expect}=require('@playwright/test'),path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {CampaignsService}=require('../apps/api/dist/src/campaigns.service');
const {PlanningService}=require('../apps/api/dist/src/ai/planning.service');
const {fixture}=require('../scripts/planning-fixtures.cjs');
test('edited fresh copy, draft replan and confirmed deletion preserve original campaign',async({page,context},info)=>{
 const db=new PrismaClient(),ids=[];let calls=0;const user=await require('./session.cjs').authenticate(context,db);
 const label='Manage browser '+info.project.name+' '+Date.now();
 try{
  const c=await new CampaignsService(db).create({name:label,businessType:'آموزش',campaignType:'فروش',product:'دوره اصلی',duration:2,offer:{kind:'بدون تخفیف',details:''},salesPath:{action:'پیام',details:''},conversionPath:null},undefined,user.id);ids.push(c.id);
  const planner=new PlanningService(db,{json:async()=>fixture()});await planner.generate(c.id);await planner.approve(c.id);
  await page.route('**/api/campaigns/*/plan',async route=>{if(route.request().method()!=='POST')return route.continue();const id=route.request().url().split('/').at(-2);const value=await new PlanningService(db,{json:async()=>{calls++;return fixture();}}).generate(id);await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(value)});});
  await page.goto('/');await page.getByRole('button',{name:new RegExp(label)}).first().click();await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
  await page.locator('.campaign-journey').getByRole('button',{name:'اطلاعات کسب‌وکار',exact:true}).click();await page.getByText('ویرایش و ساخت نسخه تازه',{exact:true}).click();
  const editor=page;
  await editor.getByRole('textbox',{name:'نام',exact:true}).fill(label+' new');await editor.getByRole('textbox',{name:'محصول',exact:true}).fill('محصول اصلاح‌شده');await editor.getByLabel('تأیید می‌کنم نسخه تازه بدون انتقال اجرای قبلی ساخته شود.').check();
  const copiedResponse=page.waitForResponse(r=>r.url().endsWith('/'+c.id+'/copy')&&r.request().method()==='POST');await editor.getByRole('button',{name:'ذخیره نسخه تازه برای طرح جدید',exact:true}).click();const response=await copiedResponse;expect(response.status()).toBe(201);const copy=await response.json();ids.push(copy.id);expect(copy.status).toBe('DRAFT');expect(copy.planningContext.conversionPath).toBe(null);expect(copy.days.length).toBe(0);expect(calls).toBe(0);
  await expect(page.getByRole('button',{name:'ساخت طرح کمپین',exact:true})).toBeVisible();await page.getByRole('button',{name:'ساخت طرح کمپین',exact:true}).click();await expect(page.getByRole('button',{name:'تأیید و ساخت برنامه اجرا',exact:true})).toBeVisible();expect(calls).toBe(1);
  await page.locator('.campaign-journey').getByRole('button',{name:'اطلاعات کسب‌وکار',exact:true}).click();await page.getByText('حذف کمپین یا ساخت طرح از نو',{exact:true}).click();await page.getByLabel('کنارگذاشتن طرح پیش‌نویس و ساخت دوباره را تأیید می‌کنم.').check();await page.getByRole('button',{name:'کنارگذاشتن طرح و شروع دوباره',exact:true}).click();await page.locator('.campaign-journey').getByRole('button',{name:'بررسی طرح',exact:true}).click();await expect(page.getByRole('button',{name:'ساخت طرح کمپین',exact:true})).toBeVisible();expect(calls).toBe(1);
  await page.locator('.campaign-journey').getByRole('button',{name:'اطلاعات کسب‌وکار',exact:true}).click();await page.getByText('حذف کمپین یا ساخت طرح از نو',{exact:true}).click();await page.getByRole('button',{name:'بررسی حذف کمپین',exact:true}).click();const deleteButton=page.getByRole('button',{name:'حذف دائمی همین کمپین',exact:true});await expect(deleteButton).toBeDisabled();await page.getByLabel('برای تأیید حذف، نام کمپین را دقیقاً بنویس').fill(label+' new');await page.getByLabel('می‌دانم حذف دائمی است و از داخل برنامه قابل بازگرداندن نیست.').check();await expect(deleteButton).toBeEnabled();await deleteButton.click();await expect(page.getByRole('heading',{name:'کمپین‌های من',exact:true})).toBeVisible();expect(calls).toBe(1);expect(await db.campaign.findUnique({where:{id:copy.id}})).toBe(null);expect((await db.campaign.findUnique({where:{id:c.id}})).status).toBe('ACTIVE');
 }finally{await db.campaign.deleteMany({where:{id:{in:ids}}});await db.user.delete({where:{id:user.id}});await db.$disconnect();}
});

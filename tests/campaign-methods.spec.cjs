const {test,expect}=require('@playwright/test');
test('beginner supplies facts, explicitly requests a method and accepts it before planning',async({page})=>{
 let campaign=null,recommendations=0,plans=0,accepted=false,createInput;
 const method={id:'webinar',components:[],title:'فروش با یک جلسه آموزشی آنلاین',journey:'ثبت‌نام، دعوت، آموزش و پیگیری',reasons:['امکان جلسه آنلاین داری'],preparation:['آماده‌سازی ارائه'],assumptions:[],limitations:['نتیجه فروش تضمین نمی‌شود']};
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,verb=route.request().method();let result;
  if(path==='/api/auth/session')result={user:{id:'owner'}};
  else if(path==='/api/campaigns'&&verb==='GET')result=campaign?[campaign]:[];
  else if(path==='/api/campaigns'&&verb==='POST'){
   createInput=route.request().postDataJSON();campaign={...createInput,id:'new',status:'DRAFT',updatedAt:'2026-10-21T00:00:00Z',days:[],preparationTasks:[],planningContext:{methodRequired:true,executionProfile:createInput.executionProfile}};result=campaign;
  }else if(path==='/api/campaigns/new')result=campaign;
  else if(path==='/api/campaigns/new/method'){
   if(verb==='POST')recommendations++;
   result={sourceHash:'a'.repeat(64),accepted:accepted?method:null,stale:false,report:recommendations?{primary:method,alternative:null,questions:[]}:null};
  }else if(path==='/api/campaigns/new/method/accept'){
   accepted=true;campaign.planningContext.methodState={accepted:method};result={sourceHash:'a'.repeat(64),accepted:method,report:{primary:method,alternative:null,questions:[]},stale:false};
  }else if(path==='/api/campaigns/new/plan'){
   expect(accepted).toBe(true);plans++;campaign.aiPlan=require('../scripts/planning-fixtures.cjs').fixture();result=campaign;
  }else return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:path})});
  await route.fulfill({status:verb==='POST'?201:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/');await page.getByRole('button',{name:'کمپین جدید',exact:true}).first().click();
 await page.getByLabel('نام کمپین',{exact:true}).fill('کمپین آموزش');await page.getByLabel('چه محصول یا خدمتی را معرفی می‌کنی؟',{exact:true}).fill('دوره آموزش کاربردی');await page.getByLabel('قیمت به تومان (اگر می‌دانی)',{exact:true}).fill('0');await page.getByRole('combobox',{name:'هدف اصلی',exact:true}).selectOption('افزایش فروش');await page.getByRole('button',{name:'ادامه',exact:true}).click();
 await page.getByRole('combobox',{name:'امکان برگزاری جلسه آنلاین داری؟',exact:true}).selectOption('yes');await page.getByLabel('تعداد مخاطب (اگر می‌دانی)',{exact:true}).fill('0');await page.getByRole('combobox',{name:'پلتفرم اصلی',exact:true}).selectOption('تلگرام');await page.getByRole('combobox',{name:'مخاطب برای اقدام چه کاری انجام دهد؟',exact:true}).selectOption('ارسال پیام');await page.getByRole('button',{name:'ادامه',exact:true}).click();await page.getByRole('button',{name:'ساخت کمپین',exact:true}).click();
 await expect(page.getByRole('heading',{name:'پیشنهاد هوشمند روش اجرا',exact:true})).toBeVisible();expect(recommendations).toBe(0);expect(plans).toBe(0);expect(createInput.methodRequired).toBe(true);expect(createInput.executionProfile.audienceSize).toBe(0);expect(createInput.offer.regularPrice).toBe('0');
 await expect(page.getByRole('button',{name:'ساخت طرح کمپین',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'پیشنهاد روش مناسب با هوش مصنوعی',exact:true}).click();await expect(page.getByRole('heading',{name:method.title,exact:true})).toBeVisible();expect(recommendations).toBe(1);expect(plans).toBe(0);
 await page.getByRole('button',{name:'با این روش ادامه بده',exact:true}).click();await expect(page.getByRole('heading',{name:'روش پذیرفته‌شده: '+method.title,exact:true})).toBeVisible();expect(campaign.status).toBe('DRAFT');
 await page.getByRole('button',{name:'ساخت طرح کمپین',exact:true}).click();await expect(page.getByRole('button',{name:'تأیید و ساخت برنامه اجرا',exact:true})).toBeVisible();expect(plans).toBe(1);expect(recommendations).toBe(1);expect(campaign.status).toBe('DRAFT');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

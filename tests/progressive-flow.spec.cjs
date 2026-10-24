const {test,expect}=require('@playwright/test');
const {fixture}=require('../scripts/planning-fixtures.cjs');

test('beginner journey preserves drafts across errors, stages and reloads without automatic AI',async({page,context},info)=>{
 let campaign=null,report=null,accepted=null,creationAttempts=0,contentSaves=0,clock=0;
 const calls={method:0,plan:0,content:0,analysis:0};
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{window.__copied=true;},writeText:async()=>{window.__copied=true;}}}));
 const stamp=()=>new Date(Date.now()+ ++clock*1000).toISOString();
 const method={id:'private',components:[],title:'فروش با گفت‌وگوی تلفنی',journey:'انتخاب مخاطب ← تماس با اجازه ← پیگیری',reasons:['امکان تماس داری','مخاطب را مشخص کرده‌ای'],preparation:['آماده‌سازی پاسخ تماس'],assumptions:['نیاز مخاطب در گفت‌وگو بررسی می‌شود'],limitations:['فروش تضمین نمی‌شود']};
 let plan=fixture();plan.phases.at(-1).endDay=3;plan.days.push({...structuredClone(plan.days.at(-1)),dayNumber:3,decisionPoint:false,decisionCriteria:null});
 const state=()=>({sourceHash:'a'.repeat(64),report,accepted,stale:false});
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,verb=route.request().method();let data=null,status=200;
  const body=()=>route.request().postDataJSON();
  if(path==='/api/auth/session')data={user:{id:'owner'}};
  else if(path==='/api/campaigns'&&verb==='GET')data=campaign?[campaign]:[];
  else if(path==='/api/campaigns'&&verb==='POST'){
   creationAttempts++;if(creationAttempts===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'خطای آزمایشی ثبت؛ اطلاعات حفظ شد'})});
   const input=body();campaign={...input,id:'guided',status:'DRAFT',updatedAt:stamp(),days:[],preparationTasks:[],planningContext:{methodRequired:true,executionProfile:input.executionProfile}};data=campaign;
  }else if(path==='/api/campaigns/guided')data=campaign;
  else if(path.endsWith('/method/answers')){expect(body().answers.calls).toBe('yes');campaign.planningContext.executionProfile.calls='yes';report=null;campaign.updatedAt=stamp();data={saved:true};}
  else if(path.endsWith('/method/accept')){accepted=method;campaign.methodReady=true;campaign.planningContext.methodState={accepted:method};data=state();}
  else if(path.endsWith('/method')){
   if(verb==='POST'){calls.method++;report=calls.method===1?{primary:null,alternative:null,questions:[{field:'calls',question:'امکان تماس تلفنی با مخاطب را داری؟'}]}:{primary:method,alternative:{...method,id:'mini',title:'یک پیشنهاد کوتاه محتوایی'},questions:[]};}
   data=state();
  }else if(path.endsWith('/plan')){if(verb==='POST'){expect(accepted.id).toBe('private');calls.plan++;campaign.aiPlan=plan;}else{plan=body().plan;campaign.aiPlan=plan;}data=campaign;}
  else if(path.endsWith('/approve')){
   campaign.status='ACTIVE';campaign.preparationTasks=[{id:'prep1',title:'آماده‌سازی پاسخ تماس',why:'پاسخ یکدست',requiredBeforeDay:1,completed:false,updatedAt:stamp()}];
   campaign.days=plan.days.map((d,i)=>({...d,id:'day'+i,date:new Date(Date.now()+i*86400000).toISOString(),guidance:d,tasks:d.tasks.map((t,j)=>({...t,id:'task'+i+'-'+j,status:'PENDING',locked:false,position:j,content:null,updatedAt:stamp(),preparationIds:i===0?['prep1']:[]}))}));data=campaign;
  }else if(path==='/api/campaigns/preparation/prep1'){Object.assign(campaign.preparationTasks[0],{completed:body().completed,updatedAt:stamp()});data=campaign.preparationTasks[0];}
  else if(path.endsWith('/preparation'))data={initialized:true,status:campaign.status,items:campaign.preparationTasks};
  else if(path.includes('/tasks/')&&path.endsWith('/content')){
   const task=campaign.days.flatMap(d=>d.tasks).find(t=>t.id===path.split('/').at(-2));
   if(verb==='POST'){calls.content++;task.content='<p>نسخه پیشنهادی برای معرفی و گفت‌وگوی واقعی.</p>';}
   else{contentSaves++;if(contentSaves===1)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'خطای آزمایشی ذخیره؛ پیش‌نویس محفوظ است'})});task.content=body().content;}
   data={id:task.id,content:task.content};
  }else if(path.includes('/days/')&&path.endsWith('/result')){const input=body();expect(input.views).toBe(0);expect(input.sales).toBe(0);expect(input.revenue).toBe(null);campaign.days[0].result={...input,id:'result1',updatedAt:stamp()};data=campaign.days[0].result;}
  else if(path.endsWith('/analysis')){if(verb==='POST')calls.analysis++;data=null;}
  else if(path.endsWith('/history'))data=[];
  else return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:path})});
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 const stage=name=>page.locator('.campaign-journey').getByRole('button',{name,exact:true});
 await page.goto('/');await page.getByRole('button',{name:'کمپین جدید',exact:true}).first().click();
 await page.getByLabel('نام کمپین',{exact:true}).fill('مسیر ساده');await page.getByLabel('چه محصول یا خدمتی را معرفی می‌کنی؟',{exact:true}).fill('خدمت مشاوره کسب‌وکار');await page.getByRole('combobox',{name:'هدف اصلی',exact:true}).selectOption('لیدگیری (دریافت اطلاعات تماس)');await page.getByLabel('قیمت به تومان (اگر می‌دانی)',{exact:true}).fill('0');await page.getByRole('button',{name:'ادامه',exact:true}).click();
 await expect(page.getByRole('heading',{name:'مخاطب و شواهد',exact:true}).first()).toBeVisible();await page.getByLabel('مخاطب اصلی چه کسانی هستند؟ (اختیاری)',{exact:true}).fill('صاحبان کسب‌وکار');await page.getByRole('button',{name:'بازگشت',exact:true}).click();await expect(page.getByLabel('نام کمپین',{exact:true})).toHaveValue('مسیر ساده');await page.getByRole('button',{name:'ادامه',exact:true}).click();await expect(page.getByLabel('مخاطب اصلی چه کسانی هستند؟ (اختیاری)',{exact:true})).toHaveValue('صاحبان کسب‌وکار');await page.getByRole('button',{name:'ادامه',exact:true}).click();
 await page.getByRole('combobox',{name:'پلتفرم اصلی',exact:true}).selectOption('تلگرام');await page.getByRole('combobox',{name:'مدت کمپین',exact:true}).selectOption('3');await page.getByRole('combobox',{name:'مخاطب برای اقدام چه کاری انجام دهد؟',exact:true}).selectOption('تماس تلفنی');await page.getByLabel('نشانی یا شماره تماس مقصد',{exact:true}).fill('09120000000');await page.getByRole('combobox',{name:'می‌توانی به پیام خصوصی پاسخ بدهی؟',exact:true}).selectOption('no');await page.getByRole('button',{name:'ادامه',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'کمپین جدید',exact:true}).first().click();await expect(page.getByRole('heading',{name:'مرور و ثبت',exact:true}).first()).toBeVisible();await page.getByRole('button',{name:'ساخت کمپین',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'خطای آزمایشی ثبت'})).toBeVisible();await page.getByRole('button',{name:'ساخت کمپین',exact:true}).click();
 await page.getByRole('button',{name:'پیشنهاد روش مناسب با هوش مصنوعی',exact:true}).click();await page.getByRole('combobox',{name:'امکان تماس تلفنی با مخاطب را داری؟',exact:true}).selectOption('yes');await page.getByRole('button',{name:'ذخیره پاسخ‌ها',exact:true}).click();expect(calls.method).toBe(1);await page.getByRole('button',{name:'پیشنهاد روش مناسب با هوش مصنوعی',exact:true}).click();
 await expect(page.getByRole('heading',{name:method.title,exact:true})).toBeVisible();await expect(page.getByText('فروش تضمین نمی‌شود',{exact:true})).not.toBeVisible();await page.getByText('مشاهده جزئیات روش',{exact:true}).click();await expect(page.getByText('فروش تضمین نمی‌شود',{exact:true})).toBeVisible();await page.getByRole('button',{name:'دیدن روش جایگزین',exact:true}).click();await expect(page.getByRole('heading',{name:'یک پیشنهاد کوتاه محتوایی',exact:true})).toBeVisible();await page.getByRole('button',{name:'دیدن پیشنهاد اصلی',exact:true}).click();await page.getByRole('button',{name:'با این روش ادامه بده',exact:true}).click();
 await stage('بررسی طرح').click();await page.getByRole('button',{name:'ساخت طرح کمپین',exact:true}).click();await page.getByText('ویرایش طرح قبل از تأیید',{exact:true}).click();await page.getByLabel('ایده محوری',{exact:true}).fill('ایده ویرایش‌شده محفوظ');await stage('اطلاعات کسب‌وکار').click();await stage('بررسی طرح').click();await page.getByText('ویرایش طرح قبل از تأیید',{exact:true}).click();await expect(page.getByLabel('ایده محوری',{exact:true})).toHaveValue('ایده ویرایش‌شده محفوظ');await page.getByRole('button',{name:'ذخیره ویرایش طرح',exact:true}).click();await page.getByRole('button',{name:'تأیید و ساخت برنامه اجرا',exact:true}).click();
 await expect(page.getByRole('heading',{name:'آماده‌سازی کمپین',exact:true})).toBeVisible();await page.getByRole('button',{name:'آماده شد',exact:true}).click();await page.getByRole('button',{name:'رفتن به اجرای روزانه',exact:true}).click();await expect(page.getByRole('heading',{name:'امروز چه کار کنم؟',exact:true})).toBeVisible();
 await page.locator('.day-cards button').nth(1).click();await page.locator('.day-cards button').first().click();
 async function openContent(){await page.locator('.compact-task').first().getByText('مشاهده جزئیات کار',{exact:true}).click();await page.locator('.compact-task').first().getByRole('button',{name:/ساخت \/ نوشتن محتوا|بازکردن محتوا/}).click();}
 await openContent();await page.getByRole('button',{name:'ساخت محتوا',exact:true}).click();const editor=page.getByLabel('متن قابل ویرایش');await expect(editor).toContainText('نسخه پیشنهادی');await editor.fill('پیش‌نویس دستی که نباید گم شود');await stage('نتایج و اصلاحات').click();await stage('اجرای روزانه').click();await openContent();await expect(editor).toContainText('پیش‌نویس دستی');await page.reload();await expect(editor).toContainText('پیش‌نویس دستی');await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'خطای آزمایشی ذخیره'})).toBeVisible();await expect(editor).toContainText('پیش‌نویس دستی');await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect(page.getByText('متن ذخیره شد.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'کپی',exact:true}).click();await expect(page.getByText('متن کپی شد.',{exact:true})).toBeVisible();
 await stage('نتایج و اصلاحات').click();await page.getByRole('button',{name:'خوب',exact:true}).click();await page.getByLabel('بازدید',{exact:true}).fill('0');await page.getByLabel('سرنخ (مشتری بالقوه)',{exact:true}).fill('2');await page.getByLabel('فروش / ثبت‌نام',{exact:true}).fill('0');await stage('اجرای روزانه').click();await stage('نتایج و اصلاحات').click();await expect(page.getByLabel('فروش / ثبت‌نام',{exact:true})).toHaveValue('0');await page.reload();await expect(page.getByLabel('بازدید',{exact:true})).toHaveValue('0');await page.getByRole('button',{name:'ثبت نتیجه روز',exact:true}).click();await expect(page.getByText('نتیجه ذخیره شد. می‌توانی بعداً اصلاحش کنی.',{exact:true})).toBeVisible();
 expect(calls).toEqual({method:2,plan:1,content:1,analysis:0});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('progressive-results.png'),fullPage:true});
});

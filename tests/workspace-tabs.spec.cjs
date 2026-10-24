const {test,expect}=require('@playwright/test');
const task=(id,title,extra={})=>({id,title,type:'CONTENT',status:'PENDING',why:'توضیح واقعی کار',locked:false,position:0,updatedAt:'2026-10-15T00:00:00Z',preparationIds:[],...extra});
const day=(id,n,date,tasks)=>({id,dayNumber:n,date,mission:'مأموریت '+n,objective:'هدف واقعی',phase:'آگاهی',tasks});
const campaign=(id,status,days)=>({id,name:'کمپین '+id,status,days,duration:3,product:'دوره',maxContentPerDay:1,updatedAt:'2026-10-15T00:00:00Z',preparationTasks:[]});
async function fixture(page){
 await page.clock.install({time:new Date('2026-10-14T21:00:00Z')});
 const a=campaign('الف','ACTIVE',[
  day('a1',1,'2026-10-14T19:00:00Z',[task('old','کار عقب افتاده')]),
  day('a2',2,'2026-10-14T21:00:00Z',[task('a-today','کار امروز الف',{metadata:{timeSlot:'۱۰:۰۰'}}),task('done','کار انجام شده',{status:'DONE',content:'متن محفوظ'}),task('locked','کار قفل شده',{locked:true,content:'متن قفل شده'})]),
  day('a3',3,'2026-10-16T09:00:00Z',[task('future','کار آینده')]),
 ]);
 const b=campaign('ب','ACTIVE',[day('b2',2,'2026-10-15T09:00:00Z',[task('b-today','کار امروز ب',{content:'متن اولیه'})])]);
 a.days[0].result={id:'r1',rating:'GOOD',views:100,leads:0,sales:null,revenue:null,feedback:'بازخورد',updatedAt:'2026-10-14T20:00:00Z'};
 const draft=campaign('پیشنویس','DRAFT',[day('legacy',1,'2026-10-15T09:00:00Z',[task('legacy-task','کار قدیمی پیش نویس')])]);
 const completed=campaign('پایان','COMPLETED',[day('completed-day',1,'2026-10-15T09:00:00Z',[task('completed-task','کار کمپین پایان یافته',{content:'متن پایان یافته'})])]);
 const cs=[a,b,draft,completed],mutations=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()!=='GET')mutations.push({path,method:req.method(),data:req.postDataJSON()});
  if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'test'}}});
  if(path==='/api/campaigns')return route.fulfill({json:cs});
  if(path.endsWith('/preparation'))return route.fulfill({json:{status:'ACTIVE',initialized:true,items:[]}});
  if(path.endsWith('/analysis')||path.endsWith('/learning'))return route.fulfill({json:null});
  if(path.endsWith('/complete')){const id=path.split('/').at(-2);const t=cs.flatMap(c=>c.days.flatMap(d=>d.tasks)).find(t=>t.id===id);t.status='DONE';return route.fulfill({json:t});}
  if(path.endsWith('/content')){const id=path.split('/').at(-2);const t=cs.flatMap(c=>c.days.flatMap(d=>d.tasks)).find(t=>t.id===id);t.content=req.postDataJSON().content;return route.fulfill({json:t});}
  const c=cs.find(c=>path==='/api/campaigns/'+encodeURIComponent(c.id)||decodeURIComponent(path)==='/api/campaigns/'+c.id);if(c)return route.fulfill({json:c});
  return route.fulfill({json:[]});
 });
 await page.goto('/');await expect(page.locator('#today-tasks-title')).toBeVisible();return {mutations,cs};
}

test('dashboard uses Tehran dates and opens the matching campaign/day; content, plan and results stay separate',async({page},testInfo)=>{
 const {mutations}=await fixture(page);
 const today=page.locator('.today-panel').first();
 await page.screenshot({path:testInfo.outputPath('dashboard.png'),fullPage:true});
 await expect(today.getByText('کار امروز الف',{exact:true})).toBeVisible();
 await expect(today.getByText('کار امروز ب',{exact:true})).toBeVisible();
 await expect(today.getByText('کار انجام شده',{exact:true})).not.toBeVisible();
 await expect(today.getByText('کار آینده',{exact:true})).toHaveCount(0);
 await expect(today.getByText('کار قدیمی پیش نویس',{exact:true})).toHaveCount(0);
 await expect(page.locator('.overdue-panel').getByText('کار عقب افتاده',{exact:true})).toBeVisible();
 expect(mutations).toEqual([]);
 await today.getByLabel('نمایش کمپین').selectOption('ب');
 await expect(today.getByText('کار امروز الف',{exact:true})).toHaveCount(0);
 await today.getByRole('button',{name:'بازکردن محتوا',exact:true}).click();
 await page.getByText('دسترسی به بخش‌های دیگر کمپین',{exact:true}).click();
 await expect(page.getByRole('tab',{name:'محتوا',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.campaign-picker select')).toHaveValue('ب');
 await expect(page.getByLabel('انتخاب روز کمپین')).toHaveValue('b2');
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveText('متن اولیه');
 await page.screenshot({path:testInfo.outputPath('content.png'),fullPage:true});
 await expect(page.getByRole('heading',{name:'آماده‌سازی کمپین',exact:true})).toHaveCount(0);
 await page.getByLabel('متن قابل ویرایش').fill('ویرایش دستی محفوظ');
 await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('متن ذخیره شد.');
 expect(mutations).toHaveLength(1);expect(mutations[0]).toMatchObject({method:'PATCH',path:'/api/campaigns/tasks/b-today/content',data:{expectedContent:'متن اولیه',content:'ویرایش دستی محفوظ'}});
 await page.getByRole('tab',{name:'برنامه',exact:true}).click();
 await expect(page.getByRole('heading',{name:'امروز چه کار کنم؟',exact:true})).toBeVisible();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveCount(0);
 await page.getByRole('tab',{name:'نتایج',exact:true}).click();
 await expect(page.getByRole('heading',{name:'این روز کمپین چطور بود؟'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'آماده‌سازی کمپین',exact:true})).toHaveCount(0);
 await expect(page.getByText('گزارش و نسخه قابل دانلود',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'اطلاعات',exact:true}).click();
 await expect(page.getByText('اطلاعات واقعی و آمادگی کمپین',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'این روز کمپین چطور بود؟'})).toHaveCount(0);
 for(const tab of await page.getByRole('tab').all())await expect(tab.locator('svg')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('completion from another campaign is correct; drafts and completed work remain protected',async({page})=>{
 const {mutations}=await fixture(page);
 await page.getByRole('button',{name:'ثبت انجام کار امروز ب',exact:true}).click();
 await expect(page.getByRole('button',{name:'ثبت انجام کار امروز ب',exact:true})).not.toBeVisible();
 expect(mutations[0]).toMatchObject({path:'/api/campaigns/tasks/b-today/complete',method:'PATCH'});
 await page.locator('.campaign-card').filter({hasText:'کمپین الف'}).click();
 await page.getByText('دسترسی به بخش‌های دیگر کمپین',{exact:true}).click();
 await page.getByRole('tab',{name:'محتوا',exact:true}).click();
 await page.getByRole('combobox',{name:'کار محتوایی',exact:true}).selectOption('locked');
 await expect(page.getByText('متن قفل شده',{exact:true})).toBeVisible();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveCount(0);
 await page.getByRole('tab',{name:'نتایج',exact:true}).click();
 await expect(page.getByText(/برای نمایش روند، حداقل دو روز/)).toBeVisible();
 await page.locator('.campaign-picker select').selectOption('پیشنویس');
 await page.getByRole('tab',{name:'محتوا',exact:true}).click();
 await expect(page.getByRole('heading',{name:'محتوا پس از تأیید طرح'})).toBeVisible();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveCount(0);
 await page.getByRole('tab',{name:'برنامه',exact:true}).click();
 await expect(page.getByRole('button',{name:'ساخت طرح کمپین',exact:true})).toBeVisible();
 await expect(page.getByText('کار قدیمی پیش نویس',{exact:true})).toHaveCount(0);
 await page.locator('.campaign-picker select').selectOption('پایان');
 await page.getByRole('tab',{name:'محتوا',exact:true}).click();
 await expect(page.getByText('متن پایان یافته',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'انجام دادم',exact:true})).toBeDisabled();
 await page.getByRole('tab',{name:'نتایج',exact:true}).click();
 await expect(page.getByRole('button',{name:'ثبت نتیجه روز',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'نتایج',exact:true}).press('Home');
 await expect(page.getByRole('tab',{name:'برنامه',exact:true})).toBeFocused();
 expect(mutations).toHaveLength(1);
});

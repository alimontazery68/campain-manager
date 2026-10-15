const {test,expect}=require('@playwright/test');

for(const hasCampaign of [false,true])test(`guide works with ${hasCampaign?'an existing campaign':'no campaigns'} without AI calls`,async({page})=>{
 const campaign={id:'guide-test',name:'کمپین تست',duration:7,status:'DRAFT',days:[],preparationTasks:[]};
 const mutations=[];
 await page.route('**/api/**',route=>{
  const req=route.request();if(req.method()!=='GET')mutations.push(req.url());
  if(new URL(req.url()).pathname==='/api/auth/session')return route.fulfill({json:{user:{id:'test'}}});
  if(new URL(req.url()).pathname==='/api/campaigns')return route.fulfill({json:hasCampaign?[campaign]:[]});
  return route.fulfill({status:404,json:{message:'Unexpected request'}});
 });
 await page.goto('/');
 await expect(page.locator(hasCampaign?'.campaign-card':'.empty-state')).toBeVisible();
 await page.getByRole('button',{name:'راهنما',exact:true}).click();
 await expect(page.getByRole('heading',{name:'راهنمای شروع کار با کمپین‌منیجر'})).toBeVisible();
 await expect(page.getByRole('button',{name:'تنظیمات',exact:true})).toHaveCount(0);
 const steps=page.locator('.guide-step h3>button');
 await expect(steps).toHaveCount(8);await expect(steps.first()).toHaveAttribute('aria-expanded','true');
 await steps.last().focus();await page.keyboard.press('Enter');
 await expect(steps.last()).toHaveAttribute('aria-expanded','true');
 await expect(steps.first()).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#guide-panel-7')).toContainText('فایل اکسل');
 await steps.first().click();
 await page.getByRole('button',{name:'ساخت کمپین جدید',exact:true}).click();
 await expect(page.locator('.simple-wizard')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.modal-backdrop')).toHaveCount(0);
 await page.getByRole('button',{name:'بازگشت به فضای کار',exact:true}).click();
 await expect(page.locator('.simple-wizard')).toHaveCount(0);
 const question=page.locator('.guide-faq summary').first();await question.focus();await page.keyboard.press('Enter');
 await expect(page.locator('.guide-faq details').first()).toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 if(hasCampaign){await page.getByRole('button',{name:'رفتن به کمپین‌های من'}).click();await expect(page.locator('.campaign-card')).toBeVisible();}
 expect(mutations).toEqual([]);
});

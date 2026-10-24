const {test,expect}=require('@playwright/test');

test('campaign deletion opens an accessible confirmation dialog and preserves explicit confirmation',async({page},testInfo)=>{
 const campaign={id:'delete-test',name:'کمپین آزمایشی',status:'DRAFT',updatedAt:'2026-10-22T00:00:00Z',duration:7,product:'محصول آزمایشی',businessType:'آموزش',campaignType:'فروش',offer:{kind:'عادی',details:''},salesPath:{action:'پیام',details:''},maxContentPerDay:1,days:[],preparationTasks:[]};
 let deletionRequests=0,previews=0,release;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let data=path==='/api/auth/session'?{user:{id:'owner'}}:path==='/api/campaigns'?[campaign]:campaign;
  if(path.endsWith('/deletion')){previews++;data={token:'token-'+previews,name:campaign.name,days:7,tasks:12,results:3};}
  if(path.endsWith('/delete')){
   deletionRequests++;
   expect(route.request().postDataJSON()).toEqual({token:'token-'+previews,name:campaign.name,confirm:true});
   if(deletionRequests===1)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'اطلاعات تغییر کرده؛ دوباره بررسی کن.'})});
   await new Promise(resolve=>{release=resolve;});data={id:campaign.id,deleted:true};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'کمپین‌های من',exact:true}).first().click();
 await page.locator('.campaign-card').click();
 await page.locator('.campaign-journey').getByRole('button',{name:'اطلاعات کسب‌وکار',exact:true}).click();
 await page.getByText('حذف کمپین یا ساخت طرح از نو',{exact:true}).click();
 const trigger=page.getByRole('button',{name:'بررسی حذف کمپین',exact:true});
 await trigger.click();
 const dialog=page.getByRole('dialog',{name:'حذف کمپین «کمپین آزمایشی»؟',exact:true});
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'انصراف از حذف',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();expect(deletionRequests).toBe(0);
 await trigger.click();await dialog.getByRole('button',{name:'انصراف از حذف',exact:true}).click();await expect(dialog).toHaveCount(0);expect(deletionRequests).toBe(0);
 await trigger.click();
 const submit=dialog.getByRole('button',{name:'حذف دائمی همین کمپین',exact:true});
 await expect(submit).toBeDisabled();
 await dialog.getByRole('textbox').fill('نام اشتباه');await dialog.getByRole('checkbox').check();await expect(submit).toBeDisabled();
 await dialog.getByRole('textbox').fill(campaign.name);await expect(submit).toBeEnabled();expect(deletionRequests).toBe(0);
 await page.screenshot({path:testInfo.outputPath('delete-confirmation.png')});
 const box=await dialog.boundingBox(),viewport=page.viewportSize();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
 await submit.click();await expect(dialog.getByRole('alert')).toHaveText('اطلاعات تغییر کرده؛ دوباره بررسی کن.');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'بستن تأیید حذف',exact:true}).click();await trigger.click();
 await expect(dialog.getByRole('textbox')).toHaveValue('');await expect(dialog.getByRole('checkbox')).not.toBeChecked();
 await dialog.getByRole('textbox').fill(campaign.name);await dialog.getByRole('checkbox').check();
 try{
  await submit.click();await expect(dialog.getByRole('button',{name:'در حال حذف…',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'انصراف از حذف',exact:true})).toBeDisabled();
  expect(deletionRequests).toBe(2);release();await expect(dialog).toHaveCount(0);
 }finally{release?.();}
});

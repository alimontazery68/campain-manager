const {test,expect}=require('@playwright/test');
async function setup(page,{saved=false,fail=false}={}){
 const tasks=['one','two'].map(id=>({id,title:'محتوای '+id,type:'CONTENT',status:'PENDING',content:saved?'متن اولیه':null,format:'متن',why:'معرفی واقعی',locked:false,position:0,updatedAt:'2026-10-15T00:00:00Z',preparationIds:[]}));
 const c={id:'c',name:'کمپین محتوا',status:'ACTIVE',product:'دوره',duration:1,days:[{id:'d',dayNumber:1,date:new Date().toISOString(),mission:'معرفی',phase:'شناخت',objective:'آگاهی',tasks}],preparationTasks:[],maxContentPerDay:2};
 const mutations=[];
 await page.route('**/api/**',r=>{
  const req=r.request(),path=new URL(req.url()).pathname;
  if(path==='/api/auth/session')return r.fulfill({json:{user:{id:'test'}}});
  if(path==='/api/campaigns')return r.fulfill({json:[c]});
  if(path==='/api/campaigns/c')return r.fulfill({json:c});
  if(path.endsWith('/preparation'))return r.fulfill({json:{status:'ACTIVE',initialized:true,items:[]}});
  if(path.endsWith('/content')){
   mutations.push({method:req.method(),body:req.postDataJSON()});
   if(fail&&req.method()==='POST')return r.fulfill({status:503,json:{message:'تولید ناموفق؛ متن قبلی حفظ شد'}});
   const t=tasks.find(t=>path.includes('/'+t.id+'/'));t.content=req.method()==='PATCH'?req.postDataJSON().content:'سناریوی تولیدشده';
   return r.fulfill({json:{id:t.id,content:t.content}});
  }
  return r.fulfill({json:null});
 });
 await page.goto('/');await page.locator('.campaign-card').click();await page.getByRole('tab',{name:'محتوا',exact:true}).click();
 await page.getByText('راهنمای تکمیلی (اختیاری)',{exact:true}).click();
 await expect(page.getByRole('combobox',{name:'لحن محتوا',exact:true})).toBeVisible();
 return {mutations,tasks};
}
test('content options are task-specific, persistent and included only on explicit AI requests',async({page})=>{
 const {mutations}=await setup(page);
 const tone=page.getByRole('combobox',{name:'لحن محتوا',exact:true}),format=page.getByRole('combobox',{name:'قالب خروجی',exact:true});
 await page.getByRole('button',{name:'رسمی',exact:true}).click();await page.getByRole('button',{name:'ویدیو',exact:true}).click();
 await page.getByLabel('چه نکته‌ای در متن پررنگ‌تر شود؟').fill('زمان کم تمرین');
 expect(mutations).toEqual([]);
 const task=page.getByRole('combobox',{name:'کار محتوایی',exact:true});
 await task.selectOption('two');await page.getByText('راهنمای تکمیلی (اختیاری)',{exact:true}).click();await expect(tone).toHaveValue('campaign');await expect(format).toHaveValue('task');
 await task.selectOption('one');await page.getByText('راهنمای تکمیلی (اختیاری)',{exact:true}).click();await expect(tone).toHaveValue('formal');await expect(format).toHaveValue('video');
 await page.getByRole('button',{name:'ساخت محتوا',exact:true}).click();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveValue('سناریوی تولیدشده');
 expect(mutations).toEqual([{method:'POST',body:{action:'generate',preferences:{tone:'formal',format:'video',instructions:'زمان کم تمرین'}}}]);
 await page.getByLabel('متن قابل ویرایش').fill('ویرایش دستی');await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('متن ذخیره شد');
 expect(mutations[1]).toEqual({method:'PATCH',body:{content:'ویرایش دستی',expectedContent:'سناریوی تولیدشده'}});
 await page.getByRole('button',{name:'کپی',exact:true}).click();expect(mutations).toHaveLength(2);
 await page.getByLabel('متن قابل ویرایش').evaluate(node=>{node.focus();node.select();});await page.getByRole('button',{name:'متن برجسته',exact:true}).click();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveValue('**ویرایش دستی**');expect(mutations).toHaveLength(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('failed regeneration preserves manual edits and sends chosen preferences after saving',async({page})=>{
 const {mutations}=await setup(page,{saved:true,fail:true});
 await page.getByRole('combobox',{name:'لحن محتوا',exact:true}).selectOption('energetic');
 await page.getByLabel('متن قابل ویرایش').fill('متن دستی مهم');
 await page.getByRole('button',{name:'ساخت مجدد با ایده تازه',exact:true}).click();
 await expect(page.locator('.inline-content-editor').getByRole('alert')).toContainText('متن قبلی حفظ شد');await expect(page.getByLabel('متن قابل ویرایش')).toHaveValue('متن دستی مهم');
 expect(mutations[0]).toEqual({method:'PATCH',body:{content:'متن دستی مهم',expectedContent:'متن اولیه'}});
 expect(mutations[1]).toEqual({method:'POST',body:{action:'regenerate',preferences:{tone:'energetic',format:'task',instructions:''}}});
});


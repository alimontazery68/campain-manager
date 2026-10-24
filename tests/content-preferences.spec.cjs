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
 await page.goto('/');await page.getByRole('button',{name:'کمپین‌های من',exact:true}).first().click();await page.locator('.campaign-card').click();await page.getByText('دسترسی به بخش‌های دیگر کمپین',{exact:true}).click();await page.getByRole('tab',{name:'محتوا',exact:true}).click();
 await page.getByText('تنظیمات تولید محتوا',{exact:true}).click();
 await expect(page.getByRole('combobox',{name:'لحن محتوا',exact:true})).toBeVisible();
 return {mutations,tasks};
}
test('content options are task-specific, persistent and included only on explicit AI requests',async({page})=>{
 const {mutations}=await setup(page);
 const tone=page.getByRole('combobox',{name:'لحن محتوا',exact:true}),format=page.getByRole('combobox',{name:'قالب خروجی',exact:true});
 await tone.selectOption('formal');await format.selectOption('video');
 await page.getByLabel('چه نکته‌ای در متن پررنگ‌تر شود؟').fill('زمان کم تمرین');
 expect(mutations).toEqual([]);
 const task=page.getByRole('combobox',{name:'کار محتوایی',exact:true});
 await task.selectOption('two');await page.getByText('تنظیمات تولید محتوا',{exact:true}).click();await expect(tone).toHaveValue('campaign');await expect(format).toHaveValue('task');
 await task.selectOption('one');await page.getByText('تنظیمات تولید محتوا',{exact:true}).click();await expect(tone).toHaveValue('formal');await expect(format).toHaveValue('video');
 await page.getByRole('button',{name:'ساخت محتوا',exact:true}).click();
 await expect(page.getByLabel('متن قابل ویرایش')).toHaveText('سناریوی تولیدشده');
 expect(mutations).toEqual([{method:'POST',body:{action:'generate',preferences:{tone:'formal',format:'video',instructions:'زمان کم تمرین'}}}]);
 await page.getByLabel('متن قابل ویرایش').fill('ویرایش دستی');await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('متن ذخیره شد');
 expect(mutations[1]).toEqual({method:'PATCH',body:{content:'ویرایش دستی',expectedContent:'سناریوی تولیدشده'}});
 await page.getByRole('button',{name:'کپی',exact:true}).click();expect(mutations).toHaveLength(2);
 await page.getByLabel('متن قابل ویرایش').evaluate(node=>{node.focus();const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});await page.getByRole('button',{name:'متن برجسته',exact:true}).click();
 await expect(page.getByLabel('متن قابل ویرایش').locator('b,strong')).toHaveText('ویرایش دستی');expect(mutations).toHaveLength(2);
 await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect.poll(()=>mutations.length).toBe(3);
 expect(mutations[2].body.content).toBe('**ویرایش دستی**');
 await task.selectOption('two');await task.selectOption('one');
 await expect(page.getByLabel('متن قابل ویرایش').locator('strong')).toHaveText('ویرایش دستی');
 await page.getByLabel('متن قابل ویرایش').evaluate(node=>{node.focus();const range=document.createRange();range.selectNodeContents(node);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.getByRole('button',{name:'انتخاب ایموجی',exact:true}).click();await expect(page.getByRole('dialog',{name:'انتخاب ایموجی',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'درج 🚀',exact:true}).click();await expect(page.getByLabel('متن قابل ویرایش')).toContainText('🚀');await expect(page.getByRole('dialog',{name:'انتخاب ایموجی',exact:true})).toHaveCount(0);
 expect(mutations).toHaveLength(3);

 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('failed regeneration preserves manual edits and sends chosen preferences after saving',async({page})=>{
 const {mutations}=await setup(page,{saved:true,fail:true});
 await page.getByRole('combobox',{name:'لحن محتوا',exact:true}).selectOption('energetic');
 await page.getByLabel('متن قابل ویرایش').fill('متن دستی مهم');
 await page.getByRole('button',{name:'ساخت مجدد با ایده تازه',exact:true}).click();
 await expect(page.locator('.inline-content-editor').getByRole('alert')).toContainText('متن قبلی حفظ شد');await expect(page.getByLabel('متن قابل ویرایش')).toHaveText('متن دستی مهم');
 expect(mutations[0]).toEqual({method:'PATCH',body:{content:'متن دستی مهم',expectedContent:'متن اولیه'}});
 expect(mutations[1]).toEqual({method:'POST',body:{action:'regenerate',preferences:{tone:'energetic',format:'task',instructions:''}}});
});


test('rich formatting, links and emoji keep the selection and survive saving',async({page})=>{
 const {mutations}=await setup(page,{saved:true});
 const editor=page.getByRole('textbox',{name:'متن قابل ویرایش',exact:true});
 async function selectAll(){await editor.evaluate(node=>{node.focus();const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});}
 async function reopen(){const tasks=page.getByRole('combobox',{name:'کار محتوایی',exact:true});await tasks.selectOption('two');await tasks.selectOption('one');}
 await editor.fill('عنوان آزمایشی');await selectAll();await page.getByRole('button',{name:'افزودن عنوان',exact:true}).click();
 await expect(editor.locator('h2')).toHaveText('عنوان آزمایشی');await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect(page.getByRole('status')).toContainText('متن ذخیره شد');await reopen();await expect(editor.locator('h2')).toHaveText('عنوان آزمایشی');
 await editor.fill('نکته مهم');await selectAll();await page.getByRole('button',{name:'متن مورب',exact:true}).click();await expect(editor.locator('i,em')).toHaveText('نکته مهم');
 await page.getByRole('button',{name:'افزودن فهرست',exact:true}).click();await expect(editor.locator('ul li')).toHaveText('نکته مهم');
 await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect(page.getByRole('status')).toContainText('متن ذخیره شد');await reopen();await expect(editor.locator('ul li em')).toHaveText('نکته مهم');
 await editor.fill('وب‌سایت');await selectAll();await page.getByRole('button',{name:'افزودن پیوند',exact:true}).click();await page.getByLabel('نشانی پیوند').fill('javascript:alert(1)');await page.getByRole('button',{name:'ثبت پیوند',exact:true}).click();await expect(page.getByRole('dialog',{name:'افزودن پیوند'}).getByRole('alert')).toBeVisible();
 await page.getByLabel('نشانی پیوند').fill('https://example.com');await page.getByRole('button',{name:'ثبت پیوند',exact:true}).click();await expect(editor.locator('a')).toHaveText('وب‌سایت');await expect(editor.locator('a')).toHaveAttribute('href','https://example.com');
 await page.getByRole('button',{name:'ذخیره متن',exact:true}).click();await expect(page.getByRole('status')).toContainText('متن ذخیره شد');await reopen();await expect(editor.locator('a')).toHaveAttribute('href','https://example.com');
 await editor.fill('سلام دنیا');await editor.evaluate(node=>{node.focus();const range=document.createRange();range.setStart(document.createTreeWalker(node,NodeFilter.SHOW_TEXT).nextNode(),5);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.getByRole('button',{name:'انتخاب ایموجی',exact:true}).click();await page.getByRole('button',{name:'درج 😊',exact:true}).click();await expect(editor).toHaveText('سلام 😊دنیا');
 await page.getByRole('button',{name:'انتخاب ایموجی',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'انتخاب ایموجی'})).toHaveCount(0);
 expect(mutations.every(m=>m.method==='PATCH')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

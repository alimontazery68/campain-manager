const {test,expect}=require('@playwright/test');
const ExcelJS=require('../apps/web/node_modules/exceljs');

test('downloads a readable Excel workbook through the report UI without AI calls',async({page})=>{
 const campaign={id:'excel-test',name:'دوره آموزش هوش مصنوعی AI1',product:'آموزش',duration:7,status:'DRAFT',days:[],preparationTasks:[],maxContentPerDay:1,updatedAt:'2026-10-15T10:00:00Z',aiPlan:{strategy:'مسیر واقعی',bigIdea:'یادگیری',coreMessage:'تمرین',assumptions:[],phases:[],preparation:[],days:[{dayNumber:1,mission:'معرفی',tasks:[{title:'معرفی دوره',content:'محتوای فارسی'}]}]}};
 const mutations=[];
 await page.route('**/api/**',route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()!=='GET')mutations.push(url.pathname);
  if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{id:'test'}}});
  if(url.pathname==='/api/campaigns')return route.fulfill({json:[campaign]});
  if(url.pathname.endsWith('/completion'))return route.fulfill({json:{summary:{},completion:{learnings:['تمرین مهم است']}}});
  if(url.pathname.endsWith('/history'))return route.fulfill({json:[{reason:'اصلاح برنامه',source:'MANUAL'}]});
  if(url.pathname==='/api/campaigns/excel-test')return route.fulfill({json:campaign});
  return route.fulfill({status:404,json:{message:'Unexpected request'}});
 });
 await page.goto('/');await page.locator('.campaign-card').click();
 const report=page.locator('details').filter({has:page.locator('summary', {hasText:'گزارش و نسخه قابل دانلود'})});
 await report.locator('summary').click();
 const downloadPromise=page.waitForEvent('download');
 await report.getByRole('button',{name:'دانلود گزارش اکسل',exact:true}).click();
 const download=await downloadPromise;expect(download.suggestedFilename()).toBe('campaign-excel-test.xlsx');
 const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(await download.path());
 expect(wb.getWorksheet('خلاصه کمپین').getCell('B2').value).toBe(campaign.name);
 expect(wb.getWorksheet('کارها و محتوا').getCell('J2').value).toBe('محتوای فارسی');
 expect(wb.getWorksheet('آموخته‌ها').getCell('B2').value).toBe('تمرین مهم است');
 expect(mutations).toEqual([]);
 await page.route('**/api/campaigns/excel-test/history',r=>r.fulfill({status:500,json:{message:'گزارش دریافت نشد'}}));
 await report.getByRole('button',{name:'دانلود گزارش اکسل',exact:true}).click();
 await expect(report.getByRole('alert')).toContainText('گزارش دریافت نشد');
 await expect(report.getByRole('button',{name:'دانلود گزارش اکسل',exact:true})).toBeEnabled();
});

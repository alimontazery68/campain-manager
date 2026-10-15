const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const ts=webRequire('typescript');
const ExcelJS=webRequire('exceljs');
const compiled=ts.transpileModule(fs.readFileSync('apps/web/app/report-workbook.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017,esModuleInterop:true},
}).outputText;
const moduleObject={exports:{}};
new Function('require','module','exports',compiled)(webRequire,moduleObject,moduleObject.exports);
const {createReportWorkbook}=moduleObject.exports;
const read=async(...args)=>{const wb=new ExcelJS.Workbook();await wb.xlsx.load(await createReportWorkbook(...args));return wb;};

test('XLSX round trip retains Persian content, zero/unknown results, learnings, history, and long text',async()=>{
 const longText='شاهد واقعی '.repeat(4000);
 const wb=await read({name:'آموزش هوش مصنوعی',status:'ACTIVE',planningContext:{evidence:longText},
  days:[{dayNumber:1,date:'2026-10-15T10:00:00Z',mission:'اعتمادسازی',tasks:[{title:'=1+1',content:'متن فارسی\nخط دوم',status:'DONE'}],result:{views:0,leads:null,revenue:'999999999999999'}},
   {dayNumber:2,tasks:[],result:null}],completion:{learnings:['آموخته واقعی']},
  preparationTasks:[{title:'آماده کردن شاهد',requiredBeforeDay:2,completed:false}]},
  {summary:{metrics:{revenue:{total:'999999999999999'}}}},[{source:'MANUAL',reason:'اصلاح',data:{before:{title:'قدیم'},after:{title:'جدید'}}}]);
 assert.equal(wb.worksheets.length,8);
 for(const sheet of wb.worksheets)assert.equal(sheet.views[0].rightToLeft,true);
 const tasks=wb.getWorksheet('کارها و محتوا');
 assert.equal(tasks.getCell('B2').value,'=1+1');
 assert.equal(tasks.getCell('B2').type,ExcelJS.ValueType.String);
 assert.equal(tasks.getCell('J2').value,'متن فارسی\nخط دوم');
 const results=wb.getWorksheet('نتایج');
 assert.equal(results.getCell('E2').value,0);
 assert.equal(results.getCell('F2').value,null);
 assert.equal(results.getCell('I2').value,999999999999999);
 assert.equal(results.getCell('C3').value,false);
 assert.equal(wb.getWorksheet('آموخته‌ها').getCell('B2').value,'آموخته واقعی');
 assert.equal(wb.getWorksheet('تاریخچه').getCell('C2').value,'اصلاح');
 let recovered='';wb.getWorksheet('جزئیات کامل').eachRow(row=>{
  if(row.getCell(1).value==='report.campaign.planningContext.evidence')recovered+=row.getCell(2).value;
 });assert.equal(recovered,longText);
});

test('draft plan is exported before execution days exist; empty campaigns produce valid workbooks',async()=>{
 const wb=await read({aiPlan:{days:[{dayNumber:1,mission:'معرفی',tasks:[{title:'نوشتن معرفی'}]}],preparation:[{title:'نمونه واقعی'}]}},{},[]);
 assert.equal(wb.getWorksheet('برنامه روزانه').getCell('D2').value,'معرفی');
 assert.equal(wb.getWorksheet('کارها و محتوا').getCell('B2').value,'نوشتن معرفی');
 assert.equal(wb.getWorksheet('آماده‌سازی').getCell('A2').value,'نمونه واقعی');
 const empty=await read({},{},[]);assert.equal(empty.getWorksheet('نتایج').rowCount,1);
});

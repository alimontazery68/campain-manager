const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('../apps/web/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync('apps/web/app/persian-date.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const result={};new Function('exports',source)(result);
const {persianToIso,isoToPersian}=result;
test('Persian dates round trip, including Persian digits and the new campaign date',()=>{
 assert.equal(persianToIso('۱۴۰۵/۰۸/۱۰'),'2026-11-01');
 assert.equal(persianToIso('١٤٠٥/٠٨/١٠'),'2026-11-01');
 assert.equal(isoToPersian('2026-10-15'),'1405/07/23');
 for(const iso of ['2026-11-01','2025-03-21','2025-03-20','2026-09-23'])assert.equal(persianToIso(isoToPersian(iso)),iso);
});
test('invalid calendar days are rejected and leap-year Esfand is accepted',()=>{
 assert.equal(persianToIso('1403/12/30'),'2025-03-20');
 for(const date of ['1404/12/30','1405/07/31','1405/13/01','1405/01/00','1405/01/32','invalid',''])assert.equal(persianToIso(date),null);
});

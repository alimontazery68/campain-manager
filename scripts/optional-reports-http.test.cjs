const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../apps/api/node_modules/reflect-metadata');
const {Module,NotFoundException}=require('../apps/api/node_modules/@nestjs/common');
const {NestFactory}=require('../apps/api/node_modules/@nestjs/core');
const {CampaignsController}=require('../apps/api/dist/src/campaigns.controller');

test('optional report endpoints return JSON null over real HTTP; saved reports and errors remain readable',async()=>{
 const dependencies=Reflect.getMetadata('design:paramtypes',CampaignsController);
 const report={sourceHash:'test',status:'PENDING',report:{summary:'گزارش محفوظ'}};
 class TestModule{}
 Module({controllers:[CampaignsController],providers:dependencies.map(provide=>({provide,useValue:{get:async id=>{
  if(id==='missing')throw new NotFoundException('کمپین پیدا نشد.');
  return id==='saved'?report:null;
 }}}))})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});
 try{
  await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  for(const endpoint of ['analysis','learning']){
   const empty=await fetch(`${base}/campaigns/empty/${endpoint}`);
   assert.equal(empty.status,200);
   assert.match(empty.headers.get('content-type')||'',/application\/json/);
   assert.equal(await empty.text(),'null');
   const saved=await fetch(`${base}/campaigns/saved/${endpoint}`);
   assert.deepEqual(await saved.json(),report);
   const missing=await fetch(`${base}/campaigns/missing/${endpoint}`);
   assert.equal(missing.status,404);assert.equal((await missing.json()).message,'کمپین پیدا نشد.');
  }
 }finally{await app.close();}
});

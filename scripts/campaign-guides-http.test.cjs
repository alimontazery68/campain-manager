const {test}=require('node:test'),assert=require('node:assert/strict');
require('../apps/api/node_modules/reflect-metadata');
const {Module}=require('../apps/api/node_modules/@nestjs/common');
const {NestFactory,APP_GUARD,Reflector}=require('../apps/api/node_modules/@nestjs/core');
const {GuidesController}=require('../apps/api/dist/src/guides.controller');
const {AuthGuard}=require('../apps/api/dist/src/auth.guard');
test('unauthenticated guide HTTP endpoint returns education only',async()=>{
 class GuideTestModule{}Module({controllers:[GuidesController],providers:[{provide:APP_GUARD,useValue:new AuthGuard(new Reflector(),{verify:()=>{throw new Error('Guide route must be public');}})}]})(GuideTestModule);
 const app=await NestFactory.create(GuideTestModule,{logger:false});await app.listen(0,'127.0.0.1');
 try{const response=await fetch((await app.getUrl())+'/guides');assert.equal(response.status,200);const body=await response.json();assert.equal(body.guides.length,7);assert.ok(body.guideVersion);assert.equal(JSON.stringify(body).includes('"agent"'),false);for(const g of body.guides)assert.equal(g.example.kind,'hypothetical');}finally{await app.close();}
});

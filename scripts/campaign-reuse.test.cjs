const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {CampaignsService}=require('../apps/api/dist/src/campaigns.service');
const {fixture}=require('./planning-fixtures.cjs');
function setup(overrides={}){
 const source={id:'source',ownerId:'owner',name:'دوره قبلی',businessType:'آموزش',campaignType:'فروش',product:'دوره کاربردی',audience:'مخاطب',problem:null,outcome:null,duration:2,target:null,maxContentPerDay:1,offer:{kind:'پیشنهاد',details:'توضیح'},salesPath:{action:'پیام',details:'پشتیبانی'},planningContext:{conversionPath:null,objections:[],proofAssets:null,availableContentFormats:['متن'],previousLearnings:['یادگیری قدیمی']},aiPlan:fixture(),completion:{learnings:['آموخته تأییدشده']},status:'COMPLETED',updatedAt:new Date('2026-10-15T00:00:00Z'),...overrides};
 const originals=structuredClone(source),copies=[],changes=[];
 const db={$queryRaw:async()=>[],campaign:{findUnique:async({where})=>where.id===source.id?source:copies.find(c=>c.creationKey===where.creationKey)||null,
 create:async({data})=>{const c={...data,id:'copy-'+copies.length,days:[],preparationTasks:[]};copies.push(c);return c;}},campaignChange:{create:async({data})=>{changes.push(data);return data;}}};
 db.$transaction=fn=>fn(db);
 return {service:new CampaignsService(db),source,originals,copies,changes,input:{name:'اجرای جدید',startDate:'2026-11-01',mode:'plan',includeLearnings:false,expectedUpdatedAt:source.updatedAt.toISOString(),key:randomUUID()}};
}
test('reuse copies saved plan and setup into a separate draft without execution or source mutations',async()=>{
 const {service,source,originals,copies,changes,input}=setup();
 const copy=await service.reuse(source.id,input);
 assert.equal(copy.status,'DRAFT');assert.equal(copy.ownerId,source.ownerId);assert.equal(copy.name,input.name);
 assert.equal(copy.startDate.toISOString(),'2026-11-01T12:00:00.000Z');assert.deepEqual(copy.aiPlan,source.aiPlan);
 assert.deepEqual(copy.planningContext,source.planningContext);assert.deepEqual(source,originals);
 assert.deepEqual(copy.days,[]);assert.deepEqual(copy.preparationTasks,[]);
 for(const key of ['completion','analysis','learning','changes','content','locked'])assert.equal(copy[key],undefined);
 assert.equal(changes[0].data.sourceCampaignId,source.id);
 assert.equal((await service.reuse(source.id,input)).id,copy.id);assert.equal(copies.length,1);
 await assert.rejects(()=>service.reuse(source.id,{...input,name:'نام متفاوت'}),/اطلاعات دیگری/);
});
test('setup-only reuse supports campaigns without plans and learning transfer is explicit',async()=>{
 const {service,source,input}=setup({aiPlan:null});
 await assert.rejects(()=>service.reuse(source.id,input),/طرح ذخیره‌شده ندارد/);
 const copy=await service.reuse(source.id,{...input,mode:'setup',includeLearnings:true});
 assert.equal(copy.aiPlan,undefined);assert.deepEqual(copy.planningContext.previousLearnings,['یادگیری قدیمی','آموخته تأییدشده']);
 for(const status of ['ACTIVE','DRAFT','PAUSED']){
  const ctx=setup({status});const c=await ctx.service.reuse(ctx.source.id,{...ctx.input,includeLearnings:true});
  assert.deepEqual(c.planningContext.previousLearnings,['یادگیری قدیمی']);
 }
});
test('reuse rejects stale sources, invalid dates and invalid stored plans',async()=>{
 const ctx=setup();
 await assert.rejects(()=>ctx.service.reuse('source',{...ctx.input,expectedUpdatedAt:'2026-10-14T00:00:00Z'}),/تغییر کرده/);
 await assert.rejects(()=>ctx.service.reuse('source',{...ctx.input,startDate:'2026-02-30'}),/تاریخ شروع/);
 const bad=setup({aiPlan:{schemaVersion:2}});await assert.rejects(()=>bad.service.reuse('source',bad.input),/طرح ذخیره‌شده.*معتبر نیست/);
 assert.equal(ctx.copies.length,0);assert.equal(bad.copies.length,0);
});

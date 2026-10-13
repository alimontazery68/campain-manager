const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {CampaignsService}=require('../apps/api/dist/campaigns.service');
const {PlanningService}=require('../apps/api/dist/ai/planning.service');
const {fixture}=require('./planning-fixtures.cjs');
const db=new PrismaClient(),ids=[];
async function main(){
 const service=new CampaignsService(db),fields={name:'Management test',businessType:'آموزش',campaignType:'فروش',product:'دوره',duration:2,offer:{kind:'بدون تخفیف',details:''},salesPath:{action:'پیام',details:''},proofAssets:[{type:'video_testimonial',description:'شاهد واقعی',count:8}],availableContentFormats:['متن'],objections:['وقت ندارم']};
 const c=await service.create(fields);ids.push(c.id);let calls=0;const planning=new PlanningService(db,{json:async()=>{calls++;return fixture();}});
 await planning.generate(c.id);let current=await service.get(c.id);await service.replan(c.id,{confirm:true,expectedUpdatedAt:current.updatedAt.toISOString()});assert.equal((await service.get(c.id)).aiPlan,null);assert.equal(calls,1);await planning.generate(c.id);assert.equal(calls,2);await planning.approve(c.id);
 current=await service.get(c.id);await db.task.update({where:{id:current.days[0].tasks[0].id},data:{content:'متن محفوظ',status:'DONE'}});await db.dailyResult.create({data:{dayId:current.days[0].id,rating:'GOOD',sales:3}});
 await assert.rejects(()=>service.replan(c.id,{confirm:true,expectedUpdatedAt:current.updatedAt.toISOString()}));
 const copyInput={fields:{...fields,name:'نسخه تازه',product:'دوره اصلاح‌شده'},confirm:true,expectedUpdatedAt:current.updatedAt.toISOString(),key:randomUUID()};
 const copied=await service.copyForEditing(c.id,copyInput);ids.push(copied.id);assert.equal((await service.copyForEditing(c.id,copyInput)).id,copied.id);assert.equal(copied.status,'DRAFT');assert.equal(copied.aiPlan,null);assert.equal(copied.days.length,0);assert.deepEqual(copied.planningContext.proofAssets,fields.proofAssets);assert.equal((await service.get(c.id)).days[0].tasks[0].content,'متن محفوظ');assert.equal(calls,2);
 await assert.rejects(()=>service.copyForEditing(c.id,{...copyInput,fields:{...copyInput.fields,name:'متفاوت'}}));
 const preview=await service.deletionPreview(c.id);assert.equal(preview.results,1);await assert.rejects(()=>service.remove(c.id,{token:preview.token,name:'نام اشتباه',confirm:true}));
 await assert.rejects(()=>service.remove(c.id,{token:preview.token,name:c.name,confirm:false}));
 await db.task.update({where:{id:current.days[0].tasks[0].id},data:{content:'تغییر همزمان'}});await assert.rejects(()=>service.remove(c.id,{token:preview.token,name:c.name,confirm:true}));
 const next=await service.deletionPreview(c.id);await service.remove(c.id,{token:next.token,name:next.name,confirm:true});assert.equal(await db.campaign.count({where:{id:c.id}}),0);assert.equal(await db.task.count({where:{dayId:{in:current.days.map(d=>d.id)}}}),0);assert.ok(await db.campaign.findUnique({where:{id:copied.id}}));
 // A delayed plan cannot overwrite a later factual edit.
 let started,release;const entered=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 const delayed=new PlanningService(db,{json:async()=>{started();await gate;return fixture();}});const pending=delayed.generate(copied.id);await entered;const before=await service.get(copied.id);
 await service.setup(copied.id,{expectedUpdatedAt:before.updatedAt.toISOString(),fields:{...copyInput.fields,product:'اطلاعات جدید'}});release();await assert.rejects(()=>pending);assert.equal((await service.get(copied.id)).aiPlan,null);
 console.log('PASS: explicit draft replan, one fresh AI call, execution-preserving edited copy, idempotent copy, confirmed deletion, stale-delete guard, cascade isolation and delayed-planning protection. Only own test campaigns removed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.campaign.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});

const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {CampaignsService}=require('../apps/api/dist/campaigns.service');
const {PlanningService}=require('../apps/api/dist/ai/planning.service');
const {fixture}=require('./planning-fixtures.cjs');
const db=new PrismaClient(),ids=[];
async function main(){
 const service=new CampaignsService(db),key=randomUUID();
 const data={name:'Setup safety test',businessType:'آموزش',campaignType:'فروش',product:'دوره مکالمه',audience:'زبان‌آموز',problem:'مکث',outcome:'تمرین',duration:2,startDate:'2026-11-01',offer:{kind:'قیمت ویژه',details:'اطلاعات واقعی',regularPrice:'۱۰۰',campaignPrice:'۸۰'},salesPath:{action:'پیام به پشتیبانی',details:'پرسش و پرداخت'}};
 const rows=await Promise.all([service.create(data,key),service.create(data,key)]);ids.push(rows[0].id);assert.equal(rows[0].id,rows[1].id);assert.equal(await db.campaign.count({where:{creationKey:key}}),1);
 await assert.rejects(()=>service.create({...data,name:'different'},key));await assert.rejects(()=>service.create({...data,startDate:'2026-02-30'},randomUUID()));
 const c=await service.get(rows[0].id);assert.equal(c.offer.campaignPrice,'۸۰');assert.deepEqual(c.context.criticalMissing,[]);
 await db.campaign.update({where:{id:c.id},data:{aiPlan:fixture()}});let fresh=await service.get(c.id);
 const edited=await service.setup(c.id,{expectedUpdatedAt:fresh.updatedAt.toISOString(),fields:{...data,product:'محصول اصلاح‌شده'}});assert.equal(edited.aiPlan,null);assert.equal(edited.product,'محصول اصلاح‌شده');
 await assert.rejects(()=>service.setup(c.id,{expectedUpdatedAt:new Date(0).toISOString(),fields:data}));
 const plan=fixture();plan.days[0].tasks[0].preparationTitles=[plan.preparation[0].title];plan.days[0].tasks[0].keyPoints=['نکته واقعی'];plan.days[0].tasks[0].contentFunction='آموزش';
 const planning=new PlanningService(db,{json:async()=>plan});await planning.generate(c.id);await planning.approve(c.id);
 fresh=await service.get(c.id);assert.equal(fresh.days[0].date.toISOString().slice(0,10),'2026-11-01');assert.equal(fresh.days[1].date.toISOString().slice(0,10),'2026-11-02');assert.equal(fresh.days[0].tasks[0].preparationIds[0],fresh.preparationTasks[0].id);assert.deepEqual(fresh.days[0].tasks[0].metadata.keyPoints,['نکته واقعی']);
 await assert.rejects(()=>service.setup(c.id,{expectedUpdatedAt:fresh.updatedAt.toISOString(),fields:data}));
 console.log('PASS: concurrent idempotency, conflicting retry, valid dates, actual offer, setup version guards, plan invalidation, start dates and task metadata/dependencies. No live AI.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const id of ids)await db.campaign.delete({where:{id}});await db.$disconnect();});

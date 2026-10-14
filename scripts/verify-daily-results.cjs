const assert=require('node:assert/strict');
const {createHmac,randomUUID}=require('node:crypto');
const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {ResultsService}=require('../apps/api/dist/src/results.service');
const {CampaignsService}=require('../apps/api/dist/src/campaigns.service');
const db=new PrismaClient();let id;let user;
function session(userId){const payload=Buffer.from(JSON.stringify({sub:userId,exp:Date.now()+3600000})).toString('base64url');return `${payload}.${createHmac('sha256',process.env.AUTH_SESSION_SECRET||'change-me').update(payload).digest('base64url')}`;}
async function main(){
  user=await db.user.create({data:{phone:'09'+randomUUID().replace(/\D/g,'').slice(0,9)}});
  const realFetch=global.fetch;global.fetch=(url,options={})=>realFetch(url,{...options,headers:{cookie:`campaign_session=${session(user.id)}`,...(options.headers||{})}});
  const campaign=await db.campaign.create({data:{name:'Daily result integration test',businessType:'خدمات',campaignType:'فروش',product:'خدمات',duration:2,status:'ACTIVE',days:{create:[{dayNumber:1,date:new Date(Date.now()-86400000),phase:'اجرا',mission:'اجرا',objective:'اقدام'},{dayNumber:2,date:new Date(Date.now()+2*86400000),phase:'اجرا',mission:'اجرا',objective:'اقدام'}]}},include:{days:{orderBy:{dayNumber:'asc'}}}});
  id=campaign.id;await db.campaign.update({where:{id},data:{ownerId:user.id}});const service=new ResultsService(db);const dayId=campaign.days[0].id;
  const first=await service.save(dayId,{rating:'GOOD',views:0,sales:null,revenue:0,feedback:'وقت ندارم',expectedUpdatedAt:null});
  assert.equal(first.views,0);assert.equal(first.sales,null);assert.equal(first.revenue.toString(),'0');
  const reread=await new CampaignsService(db).get(id);
  assert.equal(reread.days[0].result.feedback,'وقت ندارم');
  await assert.rejects(()=>service.save(dayId,{rating:'GREAT',expectedUpdatedAt:null}));
  const edited=await service.save(dayId,{rating:'GREAT',leads:15,sales:3,revenue:9900000,feedback:'زمان تمرین مهم است',expectedUpdatedAt:first.updatedAt.toISOString()});
  assert.equal(edited.id,first.id);assert.equal(await db.dailyResult.count({where:{dayId}}),1);
  assert.equal(edited.leads,15);assert.equal(edited.revenue.toString(),'9900000');assert.equal(edited.views,null);
  await assert.rejects(()=>service.save(dayId,{rating:'GOOD',sales:-1,expectedUpdatedAt:edited.updatedAt.toISOString()}));
  await assert.rejects(()=>service.save(campaign.days[1].id,{rating:'GOOD',expectedUpdatedAt:null}));
  const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:'+(process.env.API_PORT||4000);
  const response=await fetch(base+'/campaigns/days/'+dayId+'/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:'GOOD',views:200,leads:15,sales:3,revenue:9900000,feedback:'بازخورد API',expectedUpdatedAt:edited.updatedAt.toISOString()})});
  assert.equal(response.status,201);
  const apiResult=await response.json();assert.equal(apiResult.revenue,'9900000');
  const apiCampaign=await (await fetch(base+'/campaigns/'+id)).json();
  assert.equal(apiCampaign.days[0].result.feedback,'بازخورد API');
  await db.campaign.update({where:{id},data:{status:'DRAFT'}});
  await assert.rejects(()=>service.save(dayId,{rating:'WEAK',expectedUpdatedAt:edited.updatedAt.toISOString()}));
  await assert.rejects(()=>service.save('missing-day',{rating:'GOOD',expectedUpdatedAt:null}));
  console.log('PASS: persistence, unknown versus zero, editable single result, stale-write guard, numeric validation, future/draft guards and missing day.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(id)await db.campaign.delete({where:{id}});if(user)await db.user.delete({where:{id:user.id}});await db.$disconnect();});

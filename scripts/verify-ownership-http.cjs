const assert=require('node:assert/strict'),path=require('node:path');
const {createHmac,randomUUID}=require('node:crypto');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const db=new PrismaClient();let campaignId;const extraIds=[];let owner;let other;
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:'+(process.env.API_PORT||4000);
function session(id){const payload=Buffer.from(JSON.stringify({sub:id,exp:Date.now()+3600000})).toString('base64url');return `${payload}.${createHmac('sha256',process.env.AUTH_SESSION_SECRET||'change-me').update(payload).digest('base64url')}`;}
const auth=id=>({cookie:`campaign_session=${session(id)}`});
async function main(){
  owner=await db.user.create({data:{phone:'09'+randomUUID().replace(/\D/g,'').slice(0,9)}});
  other=await db.user.create({data:{phone:'09'+randomUUID().replace(/\D/g,'').slice(0,9)}});
  const campaign=await db.campaign.create({data:{ownerId:owner.id,name:'Ownership HTTP test',businessType:'آموزش',campaignType:'فروش',product:'دوره',duration:1,status:'ACTIVE',days:{create:{dayNumber:1,date:new Date(),phase:'اجرا',mission:'اجرا',objective:'آزمایش',tasks:{create:{title:'کار آزمایشی',type:'OPERATIONAL'}}}}},include:{days:{include:{tasks:true}}}});
  campaignId=campaign.id;const taskId=campaign.days[0].tasks[0].id;
  const ownerRead=await fetch(base+'/campaigns/'+campaignId,{headers:auth(owner.id)});assert.equal(ownerRead.status,200);
  const otherRead=await fetch(base+'/campaigns/'+campaignId,{headers:auth(other.id)});assert.ok([403,404].includes(otherRead.status),'Foreign campaign must not be accessible');
  const otherTask=await fetch(base+'/campaigns/tasks/'+taskId+'/complete',{method:'PATCH',headers:auth(other.id)});assert.ok([403,404].includes(otherTask.status),'Foreign task must not be accessible');
  const ownerTask=await fetch(base+'/campaigns/tasks/'+taskId+'/complete',{method:'PATCH',headers:auth(owner.id)});assert.equal(ownerTask.status,200);
  const fields={name:'Ownership retry test',businessType:'service',campaignType:'sales',product:'real product',duration:3,maxContentPerDay:1,offer:{kind:'none',details:''},salesPath:{action:'message',details:''}};
  const key=randomUUID();
  const created=await fetch(base+'/campaigns',{method:'POST',headers:{...auth(owner.id),'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(fields)});assert.equal(created.status,201);const source=await created.json();extraIds.push(source.id);
  const foreignRetry=await fetch(base+'/campaigns',{method:'POST',headers:{...auth(other.id),'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(fields)});assert.equal(foreignRetry.status,409,'A creation key cannot return another owner campaign');
  const copied=await fetch(base+'/campaigns/'+source.id+'/copy',{method:'POST',headers:{...auth(owner.id),'Content-Type':'application/json'},body:JSON.stringify({expectedUpdatedAt:source.updatedAt,fields,key:randomUUID(),confirm:true})});assert.equal(copied.status,201);const copy=await copied.json();extraIds.push(copy.id);assert.equal(copy.ownerId,owner.id);
  assert.equal((await fetch(base+'/campaigns/'+copy.id,{headers:auth(owner.id)})).status,200);
  assert.ok([403,404].includes((await fetch(base+'/campaigns/'+copy.id,{headers:auth(other.id)})).status));
  console.log('PASS: HTTP campaign and task ownership enforcement with two signed sessions.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(extraIds.length)await db.campaign.deleteMany({where:{id:{in:extraIds}}});if(campaignId)await db.campaign.delete({where:{id:campaignId}});if(owner)await db.user.delete({where:{id:owner.id}});if(other)await db.user.delete({where:{id:other.id}});await db.$disconnect();});

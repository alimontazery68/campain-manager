const assert=require('node:assert/strict');
const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {ContentService}=require('../apps/api/dist/ai/content.service');
const db=new PrismaClient();let id;
async function main(){
  const campaign=await db.campaign.create({data:{name:'Content integration test',businessType:'مشاوره',campaignType:'جذب مشتری',product:'مشاوره',duration:1,status:'ACTIVE',salesPath:{action:'رزرو مشاوره',details:'پیام به پشتیبانی'},days:{create:{dayNumber:1,date:new Date(),phase:'اعتماد',mission:'شناخت روش',objective:'تماس',tasks:{create:[{title:'معرفی روش',type:'CONTENT',format:'متن',cta:'رزرو مشاوره',why:'شناخت روش'},{title:'بررسی پیام‌ها',type:'SUPPORT'}]}}}},include:{days:{include:{tasks:true}}}});
  id=campaign.id;
  const task=campaign.days[0].tasks.find(t=>t.type==='CONTENT');
  let calls=0;let last;
  const service=new ContentService(db,{json:async(system,input)=>{calls++;last=input;return {content:input.action==='shorter'?'پیام بده.':'برای مشاوره پیام بده.'};}});
  await service.generate(task.id,{});await service.generate(task.id,{});
  assert.equal(calls,1);assert.equal(last.day.phase,'اعتماد');assert.equal(last.campaign.salesPath.action,'رزرو مشاوره');
  await service.save(task.id,{content:'متن ویرایش‌شده من',expectedContent:'برای مشاوره پیام بده.'});
  assert.equal((await db.task.findUnique({where:{id:task.id}})).content,'متن ویرایش‌شده من');
  await assert.rejects(()=>service.save(task.id,{content:'نسخه قدیمی',expectedContent:'برای مشاوره پیام بده.'}));
  const bad=new ContentService(db,{json:async()=>({content:''})});
  await assert.rejects(()=>bad.generate(task.id,{action:'regenerate'}));
  assert.equal((await db.task.findUnique({where:{id:task.id}})).content,'متن ویرایش‌شده من');
  await service.generate(task.id,{action:'shorter'});assert.equal(last.currentContent,'متن ویرایش‌شده من');assert.equal(last.action,'shorter');
  const racing=new ContentService(db,{json:async()=>{
    await service.save(task.id,{content:'ویرایش جدیدتر',expectedContent:'پیام بده.'});
    return {content:'پاسخ دیرهنگام مدل'};
  }});
  await assert.rejects(()=>racing.generate(task.id,{action:'regenerate'}));
  assert.equal((await db.task.findUnique({where:{id:task.id}})).content,'ویرایش جدیدتر');
  await assert.rejects(()=>service.generate(campaign.days[0].tasks.find(t=>t.type==='SUPPORT').id,{}));
  await db.campaign.update({where:{id},data:{status:'DRAFT'}});
  await assert.rejects(()=>service.generate(task.id,{}));
  console.log('PASS: task context, generation cache, manual persistence, revision, invalid output preservation, stale-write protection, non-content and unapproved campaign guards.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(id)await db.campaign.delete({where:{id}});await db.$disconnect();});

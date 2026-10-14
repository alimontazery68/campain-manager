const assert=require('node:assert/strict'),path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {AnalysisService}=require('../apps/api/dist/src/ai/analysis.service');
const {validateOptimization,optimizationInput,deterministicCalculations}=require('../apps/api/dist/src/ai/optimization');
const {ResultsService}=require('../apps/api/dist/src/results.service');
const {DeepSeekProvider}=require('../apps/api/dist/src/ai/deepseek');
const {optimizationPrompt}=require('../apps/api/dist/src/ai/optimization');
const {review,task}=require('./optimization-fixtures.cjs');
const db=new PrismaClient(),ids=[];
async function main(){
 const c=await db.campaign.create({data:{name:'Optimization 10 day scenario',businessType:'آموزش',campaignType:'فروش',product:'دوره؛ زمان واقعی تمرین ۱۰ دقیقه',duration:10,status:'ACTIVE',maxContentPerDay:2,planningContext:{availableContentFormats:['متن','ویس'],proofAssets:[{type:'video_testimonial',description:'رضایت واقعی',count:8}],objections:['وقت ندارم']},salesPath:{action:'پیام به پشتیبانی',details:'پرسش و پرداخت'},days:{create:Array.from({length:10},(_,i)=>({dayNumber:i+1,date:new Date(Date.now()+(i-3)*86400000),phase:i<4?'شناخت':'اقدام',mission:'مأموریت محفوظ',objective:'هدف',guidance:{successSignals:['پرسش مرتبط'],ctaIntensity:i<4?1:3},tasks:{create:[{...task('کار روز '+(i+1)),status:i<4?'DONE':'PENDING',content:i<4?'متن تاریخی':null},{title:'کار محافظت‌شده '+(i+1),type:'SUPPORT',locked:true}]}}))}},include:{days:{include:{tasks:true,result:true},orderBy:{dayNumber:'asc'}}}});ids.push(c.id);
 const other=await db.campaign.create({data:{name:'Other campaign guard',businessType:'خدمات',campaignType:'فروش',product:'خدمت',duration:1,status:'ACTIVE',days:{create:{dayNumber:1,date:new Date(Date.now()+2*86400000),phase:'اجرا',mission:'محفوظ',objective:'هدف',tasks:{create:task('متعلق به کمپین دیگر')}}}},include:{days:{include:{tasks:true}}}});ids.push(other.id);
 let calls=0,report,input;
 const service=new AnalysisService(db,{json:async(_system,value)=>{calls++;input=value;if(report instanceof Error)throw report;return report;}});
 const results=new ResultsService(db),feedback='امروز چند نفر درباره دوره سؤال کردند. چند نفر چون شاغل هستند نگران وقت جلسات و تمرین بودند. دو نفر هم قبلاً دوره زبان خریده‌اند ولی نتیجه نگرفته‌اند.';
 const saved=await results.save(c.days[3].id,{rating:'NORMAL',views:2800,leads:18,sales:3,revenue:null,feedback,expectedUpdatedAt:null});assert.equal(calls,0);assert.equal(saved.warmLeads,null);
 const load=()=>db.campaign.findUniqueOrThrow({where:{id:c.id},include:{changes:{where:{source:'AI_APPROVED'},orderBy:{createdAt:'asc'}},preparationTasks:{orderBy:{position:'asc'}},days:{orderBy:{dayNumber:'asc'},include:{result:true,tasks:{where:{archived:false},orderBy:[{position:'asc'},{id:'asc'}]}}}}});
 let fresh=await load(),editable=fresh.days[4].tasks.find(t=>!t.locked),locked=fresh.days[4].tasks.find(t=>t.locked);
 const change={operation:'EDIT',targetDayNumber:5,targetTaskId:editable.id,task:task(),reason:'زمان در بازخورد واقعی مطرح شده است.'};
 report=review([change]);const historical=JSON.stringify(fresh.days.slice(0,4));
 assert.deepEqual(deterministicCalculations(fresh),[],'Unknown revenue and unverified cohorts create no ratio');
 const compact=optimizationInput(fresh);assert.equal(compact.results[0].warmLeads,null);assert.equal(compact.results[0].revenue,null);assert.equal(compact.currentState.currentDay,4);assert.ok(!JSON.stringify(compact).includes('متن تاریخی'));assert.deepEqual(compact.currentState.remainingDays[0].successSignals,['پرسش مرتبط']);
 for(const bad of [{...change,targetDayNumber:4,targetTaskId:fresh.days[3].tasks[0].id},{...change,targetTaskId:locked.id},{...change,targetTaskId:other.days[0].tasks[0].id},{...change,targetTaskId:'missing'},{...change,targetDayNumber:6}])assert.throws(()=>validateOptimization(review([bad]),fresh));
 assert.throws(()=>validateOptimization(review([{...change,operation:'ADD',targetTaskId:null},{...change,operation:'ADD',targetTaskId:null}], 'ADD_TASK'),fresh));
 assert.throws(()=>validateOptimization({...review(),calculations:[{label:'جعلی',value:'16.7%',basis:'messages-sales'}]},fresh));
 assert.throws(()=>validateOptimization({...review(),recommendation:{...review().recommendation,proposedChanges:[change]}},fresh));
 const ctaTask=Object.fromEntries(['title','type','format','objective','why','cta','requiredAsset'].map(key=>[key,editable[key]]));ctaTask.cta='اقدام متناسب با مرحله';
 assert.doesNotThrow(()=>validateOptimization(review([{...change,task:ctaTask}],'CHANGE_CTA'),fresh));
 assert.throws(()=>validateOptimization(review([{...change,task:{...ctaTask,title:'تغییر پنهان عنوان'}}],'CHANGE_CTA'),fresh));
 const first=await service.generate(c.id);await service.generate(c.id);await service.get(c.id);assert.equal(calls,1);assert.equal((await db.task.findUnique({where:{id:editable.id}})).title,editable.title);
 assert.equal(input.results[0].sales,3);assert.equal(input.results[0].leads,18);assert.equal(input.results[0].warmLeads,null);
 await db.task.update({where:{id:editable.id},data:{locked:true}});assert.equal((await service.get(c.id)).stale,true);await assert.rejects(()=>service.decide(c.id,{sourceHash:first.sourceHash,action:'apply'}));
 await db.task.update({where:{id:editable.id},data:{locked:false}});const second=await service.generate(c.id);await service.decide(c.id,{sourceHash:second.sourceHash,action:'apply'});await service.decide(c.id,{sourceHash:second.sourceHash,action:'apply'});assert.equal(calls,2);
 assert.equal((await db.task.findUnique({where:{id:editable.id}})).title,task().title);assert.equal(await db.campaignChange.count({where:{campaignId:c.id,source:'AI_APPROVED'}}),1);
 fresh=await load();assert.equal(JSON.stringify(fresh.days.slice(0,4)),historical);assert.equal(fresh.days[4].tasks.find(t=>t.id===locked.id).locked,true);assert.deepEqual(fresh.aiPlan,c.aiPlan);
 report=review([{operation:'ADD',targetDayNumber:6,targetTaskId:null,task:{...task('پیگیری علاقه‌مند واقعی'),type:'FOLLOW_UP',format:null},reason:'اگر بازخورد نشان‌دهنده علاقه واقعی است، محترمانه پیگیری کن'}],'ADD_FOLLOW_UP');
 const rejected=await service.generate(c.id),beforeReject=JSON.stringify((await load()).days);await service.decide(c.id,{sourceHash:rejected.sourceHash,action:'dismiss'});await service.generate(c.id);assert.equal(JSON.stringify((await load()).days),beforeReject);
 assert.ok(input.previousAcceptedChanges.length>0);
 // Change factual result to permit an intentional fresh review; persistence still makes no AI call.
 await results.save(c.days[3].id,{rating:'NORMAL',views:2800,leads:18,warmLeads:12,sales:3,revenue:null,feedback,notes:'۱۲ علاقه‌مند واقعی',expectedUpdatedAt:saved.updatedAt.toISOString()});
 const add=await service.generate(c.id);await service.decide(c.id,{sourceHash:add.sourceHash,action:'apply'});await service.decide(c.id,{sourceHash:add.sourceHash,action:'apply'});
 assert.equal(await db.task.count({where:{dayId:c.days[5].id,type:'FOLLOW_UP'}}),1);
 report=review();const unchanged=JSON.stringify((await load()).days),none=await service.generate(c.id);await service.decide(c.id,{sourceHash:none.sourceHash,action:'apply'});assert.equal(JSON.stringify((await load()).days),unchanged);
 report=new Error('provider failure');await db.task.update({where:{id:editable.id},data:{why:'تغییر جدید'}});
 await assert.rejects(()=>service.generate(c.id));assert.equal((await db.dailyResult.findUnique({where:{dayId:c.days[3].id}})).feedback,feedback);assert.equal((await service.get(c.id)).status,'APPLIED');
 fresh=await load();const altered=structuredClone(fresh);altered.days[3].result.sales=null;altered.days[3].result.revenue='100';assert.deepEqual(deterministicCalculations(altered),[]);altered.days[3].result.sales=0;assert.deepEqual(deterministicCalculations(altered),[]);altered.days[3].result.sales=3;altered.days[3].result.leads=null;assert.equal(deterministicCalculations(altered)[0].value,'33.33 تومان');
 const move={operation:'MOVE',targetDayNumber:7,targetTaskId:editable.id,task:null,reason:'ترتیب متناسب با سیگنال واقعی'};report=review([move],'MOVE_TASK');let proposal=await service.generate(c.id);await service.decide(c.id,{sourceHash:proposal.sourceHash,action:'apply'});assert.equal((await db.task.findUnique({where:{id:editable.id}})).dayId,c.days[6].id);
 report=review([{operation:'REMOVE',targetDayNumber:7,targetTaskId:editable.id,task:null,reason:'حذف کار زائد با حفظ سابقه'}],'REMOVE_TASK');proposal=await service.generate(c.id);await service.decide(c.id,{sourceHash:proposal.sourceHash,action:'apply'});assert.equal((await db.task.findUnique({where:{id:editable.id}})).archived,true);
 const oldMode=process.env.AI_MOCK_MODE,oldNode=process.env.NODE_ENV;try{process.env.AI_MOCK_MODE='true';process.env.NODE_ENV='development';const mock=await new DeepSeekProvider().json(optimizationPrompt,optimizationInput(await load()));assert.equal(mock.recommendation.type,'NO_CHANGE');process.env.NODE_ENV='production';await assert.rejects(()=>new DeepSeekProvider().json(optimizationPrompt,{}));}finally{if(oldMode===undefined)delete process.env.AI_MOCK_MODE;else process.env.AI_MOCK_MODE=oldMode;if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;}
 // Two service instances share the persisted reservation and must not spend twice.
 await db.task.update({where:{id:locked.id},data:{why:'نسخه جدید برای آزمون درخواست همزمان'}});
 let entered,release;const started=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});let duplicateCalls=0;
 const holding=new AnalysisService(db,{json:async()=>{entered();await gate;return review();}}),duplicate=new AnalysisService(db,{json:async()=>{duplicateCalls++;return review();}});
 const running=holding.generate(c.id);await started;await assert.rejects(()=>duplicate.generate(c.id));release();await running;await duplicate.generate(c.id);assert.equal(duplicateCalls,0);
 console.log('PASS: 10-day scenario, null/zero metrics, no invented conversion/warm leads, compact context, cached one-call review, explicit granular approval, protected days/tasks, foreign campaign guards, stale proposal, rejection, idempotence, follow-up add, move/archive, NO_CHANGE, history, failure preserves results, cross-instance request reservation and development-only mock. No real AI.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const id of ids)await db.campaign.delete({where:{id}});await db.$disconnect();});

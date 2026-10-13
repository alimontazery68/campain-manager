// Full persisted path with the real provider serializer and a mocked transport: no paid requests.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),Module=require('node:module');
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const ts=require('../apps/web/node_modules/typescript'),file=path.resolve(__dirname,'../apps/web/app/planning-details.ts');
const helper=new Module(file,module);helper.filename=file;helper.paths=module.paths;
helper._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {buildDetailedInput,emptyDetails}=helper.exports;
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {PlanningService}=require('../apps/api/dist/ai/planning.service');
const {DeepSeekProvider}=require('../apps/api/dist/ai/deepseek');
const {planningPrompt}=require('../apps/api/dist/ai/planning');
const {fixture}=require('./planning-fixtures.cjs');
const db=new PrismaClient(),ids=[],realFetch=global.fetch,oldKey=process.env.DEEPSEEK_API_KEY,oldBase=process.env.DEEPSEEK_BASE_URL;
async function main(){
 const details=buildDetailedInput({...emptyDetails,mode:'detailed',maxContentPerDay:3,objectionsStatus:'known',objections:'وقت ندارم\nگران است\nنتیجه می‌گیرم؟',proofStatus:'known',proofs:[{type:'text_testimonial',description:'۴۰ رضایت متنی واقعی',count:'۴۰'},{type:'video_testimonial',description:'۸ رضایت ویدیویی واقعی',count:'۸'}],formatsStatus:'known',formats:['متن','ویس','ویدیو']});
 const conversionPath={action:'پیام به پشتیبانی',details:'پرسش، بررسی تناسب و پرداخت',steps:['پرسش','بررسی تناسب','پرداخت']};
 const api=process.env.TEST_BASE_URL||'http://127.0.0.1:'+(process.env.API_PORT||4000);
 const response=await realFetch(api+'/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Planning data flow test',businessType:'آموزش',campaignType:'فروش',product:'دوره مکالمه',audience:'زبان‌آموز',duration:2,target:20,offer:{kind:'بدون تخفیف',details:'شرایط واقعی'},salesPath:{action:'مسیر قدیمی',details:''},conversionPath,...details})});
 assert.equal(response.status,201);const c=await response.json();ids.push(c.id);assert.equal(c.days.length,0);
 const stored=await db.campaign.findUniqueOrThrow({where:{id:c.id}});
 for(const field of ['objections','proofAssets','availableContentFormats'])assert.deepEqual(stored.planningContext[field],details[field]);
 assert.deepEqual(stored.planningContext.conversionPath,conversionPath);assert.equal(stored.maxContentPerDay,3);
 const plan=fixture();plan.phases[0].proofToUse=details.proofAssets.map(a=>a.description);plan.phases[0].objectionsToAddress=details.objections;
 plan.days[0].successSignals=['پرسش مرتبط درباره نتیجه و روش'];plan.days[1].successSignals=['اقدام واقعی خریدار آماده','ثبت دلیل عدم خرید'];
 plan.days[0].decisionPoint=true;plan.days[0].decisionCriteria={whatToCheck:['نگرانی نتیجه'],possibleSignals:['سؤال تکراری درباره روش'],possibleResponses:['توضیح روش در روز آینده']};
 plan.days[1].decisionPoint=false;plan.days[1].decisionCriteria=null;
 plan.days[0].tasks[0]={...plan.days[0].tasks[0],title:'یک رضایت ویدیویی واقعی مرتبط با نگرانی نتیجه گرفتن انتخاب و منتشر کن',format:'ویدیو',cta:'کدام بخش برایت سؤال دارد؟',requiredAsset:details.proofAssets[1].description};
 plan.days[0].tasks.push({...plan.days[0].tasks[0],title:'روش تمرین را با ویس توضیح بده',format:'ویس',requiredAsset:null,cta:'سؤال مرتبطت را بپرس'});
 plan.days[1].mission='اقدام خریدار آماده، ثبت دلایل عدم خرید و یادگیری';plan.days[1].tasks[1].title='اگر افرادی قبلاً سؤال کرده‌اند و مرددند، با احترام تردیدشان را ثبت کن';
 let calls=0,requestInput;
 process.env.DEEPSEEK_API_KEY='test-only-not-real';process.env.DEEPSEEK_BASE_URL='https://planning-flow.invalid';
 global.fetch=async(url,options)=>{
  // Hard deny every provider endpoint other than the isolated fake endpoint.
  assert.equal(String(url),'https://planning-flow.invalid/chat/completions');calls++;
  const body=JSON.parse(options.body);assert.equal(body.messages[0].content,planningPrompt);requestInput=JSON.parse(body.messages[1].content);
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(plan)}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const planning=new PlanningService(db,new DeepSeekProvider());await planning.generate(c.id);await planning.generate(c.id);assert.equal(calls,1);
 for(const field of ['objections','proofAssets','availableContentFormats'])assert.deepEqual(requestInput[field],details[field]);
 assert.deepEqual(requestInput.conversionPath,conversionPath);assert.equal(requestInput.maxContentPerDay,3);
 const normalized=requestInput.normalizedContext;assert.deepEqual(normalized.audience.objections,details.objections);assert.deepEqual(normalized.proofAssets,details.proofAssets);assert.deepEqual(normalized.contentResources,details.availableContentFormats);assert.deepEqual(normalized.conversionPath,conversionPath);assert.equal(normalized.executionCapacity.maxContentPerDay,3);
 assert.deepEqual((await db.campaign.findUniqueOrThrow({where:{id:c.id}})).aiPlan.days,plan.days);
 await planning.approve(c.id);assert.equal(calls,1);global.fetch=realFetch;
 const reread=await realFetch(api+'/campaigns/'+c.id);assert.equal(reread.status,200);const execution=await reread.json();
 for(const day of execution.days){const planned=plan.days.find(p=>p.dayNumber===day.dayNumber);assert.deepEqual(day.guidance.successSignals,planned.successSignals);assert.equal(day.guidance.ctaIntensity,planned.ctaIntensity);assert.deepEqual(day.guidance.decisionCriteria,planned.decisionCriteria);assert.equal(day.tasks.filter(t=>t.type==='CONTENT').length,planned.tasks.filter(t=>t.type==='CONTENT').length);}
 const content=execution.days[0].tasks.filter(t=>t.type==='CONTENT');assert.deepEqual(content.map(t=>t.format),['ویدیو','ویس']);assert.equal(content[0].requiredAsset,details.proofAssets[1].description);assert.equal(content[0].cta,plan.days[0].tasks[0].cta);
 assert.equal(execution.days[1].guidance.decisionPoint,false);assert.deepEqual(execution.context.proofAssets,details.proofAssets);
 console.log('PASS: setup helper → HTTP → PostgreSQL → normalized context → actual DeepSeek serialization (mocked transport) → validated saved plan → approval → execution API. Proof, objections, formats, path, capacity, daily signals/CTA and final review survive; one provider call.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;if(oldKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=oldKey;if(oldBase===undefined)delete process.env.DEEPSEEK_BASE_URL;else process.env.DEEPSEEK_BASE_URL=oldBase;for(const id of ids)await db.campaign.delete({where:{id}});await db.$disconnect();});

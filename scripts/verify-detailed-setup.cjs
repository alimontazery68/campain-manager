const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('../apps/web/node_modules/typescript');
const filename=path.resolve(__dirname,'../apps/web/app/planning-details.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper=new Module(filename,module);helper.filename=filename;helper.paths=module.paths;helper._compile(compiled,filename);
const {emptyDetails,buildDetailedInput}=helper.exports;
process.loadEnvFile(path.resolve(__dirname,'../apps/api/.env'));
const {PrismaClient}=require('../apps/api/node_modules/@prisma/client');
const {PlanningService}=require('../apps/api/dist/ai/planning.service');
const {fixture}=require('./planning-fixtures.cjs');
const db=new PrismaClient(),ids=[];
async function main(){
 assert.deepEqual(buildDetailedInput(emptyDetails),{maxContentPerDay:1});
 const detailed={...emptyDetails,mode:'detailed'};
 assert.deepEqual(buildDetailedInput(detailed),{maxContentPerDay:1,objections:null,proofAssets:null,availableContentFormats:null});
 const none={...detailed,objectionsStatus:'none',proofStatus:'none',formatsStatus:'none'};
 assert.deepEqual(buildDetailedInput(none),{maxContentPerDay:1,objections:[],proofAssets:[],availableContentFormats:[]});
 const known={...detailed,maxContentPerDay:3,objectionsStatus:'known',objections:'وقت ندارم\n قیمت',proofStatus:'known',proofs:[{type:'رضایت ویدیویی مشتری',description:'۸ ویدیوی واقعی',count:'۸'},{type:'دمو',description:'نمایش واقعی محصول',count:''}],formatsStatus:'known',formats:['متن','ویس']};
 const facts=buildDetailedInput(known);assert.equal(facts.proofAssets[0].count,8);assert.equal(facts.proofAssets[1].count,undefined);
 assert.equal(buildDetailedInput({...known,proofs:[{type:'دمو',description:'واقعی',count:'۰'}]}).proofAssets[0].count,0);
 for(const bad of [{...known,maxContentPerDay:5},{...known,objections:''},{...known,formats:[]},{...known,proofs:[]},{...known,proofs:[{type:'دمو',description:'واقعی',count:'-1'}]}])assert.throws(()=>buildDetailedInput(bad));
 assert.deepEqual(buildDetailedInput({...known,mode:'quick'}),{maxContentPerDay:3},'Hidden details must not leak into quick setup');
 const base=process.env.TEST_BASE_URL||'http://127.0.0.1:'+(process.env.API_PORT||4000);
 let calls=0,captured;
 const planning=new PlanningService(db,{json:async(_system,input)=>{calls++;captured=input;return fixture('education');}});
 for(const details of [emptyDetails,detailed,none,known]){
  const data={name:'Detailed setup test',businessType:'آموزش',campaignType:'فروش',product:'دوره آموزشی',duration:2,offer:{kind:'ندارم',details:''},salesPath:{action:'پیام به پشتیبانی',details:'دریافت توضیحات'},...buildDetailedInput(details)};
  const response=await fetch(base+'/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status,201);
  const campaign=await response.json();ids.push(campaign.id);assert.equal(campaign.days.length,0);assert.equal(campaign.aiPlan,null);assert.equal(campaign.maxContentPerDay,data.maxContentPerDay);
  const get=await fetch(base+'/campaigns/'+campaign.id);assert.equal(get.status,200);const reread=await get.json();
  if(details.mode==='quick')assert.equal(reread.planningContext.proofAssets,undefined);else assert.deepEqual(reread.planningContext.proofAssets,data.proofAssets);
  const before=calls;await planning.generate(campaign.id);assert.equal(calls,before+1);await planning.generate(campaign.id);assert.equal(calls,before+1);
  assert.deepEqual(captured.proofAssets,data.proofAssets);assert.deepEqual(captured.objections,data.objections);assert.deepEqual(captured.availableContentFormats,data.availableContentFormats);assert.equal(captured.maxContentPerDay,data.maxContentPerDay);
 }
 console.log('PASS: quick/detailed mapping, unknown versus none, Persian counts including zero, invalid inputs, HTTP persistence, exact planning input and one cached mocked AI request per plan. No live AI calls.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const id of ids)await db.campaign.delete({where:{id}});await db.$disconnect();});

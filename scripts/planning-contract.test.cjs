const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./planning-fixtures.cjs');
const {validatePlan,validateStoredPlan,planningPrompt}=require('../apps/api/dist/ai/planning');
const {buildPlanningInput,PlanningContextSchema}=require('../apps/api/dist/ai/planning-context');
const source={businessType:'آموزش',campaignType:'فروش',product:'دوره',audience:null,problem:null,outcome:null,offer:null,salesPath:{action:'پیام به پشتیبانی',details:'پرداخت'},duration:2,target:null,maxContentPerDay:1};
test('A/B/C: contract preserves distinct example strategies, audience-state progression and booking CTA',()=>{
  const education=validatePlan(fixture(),2,1),physical=validatePlan(fixture('physical'),2,1),consulting=validatePlan(fixture('consulting'),2,1);
  assert.notEqual(education.days[0].audienceStateBefore,education.days[0].desiredAudienceStateAfter);
  assert.equal(education.days[1].audienceStateBefore,education.days[0].desiredAudienceStateAfter);
  assert.notEqual(physical.strategy,education.strategy);
  assert.equal(consulting.primaryCTA,'رزرو مشاوره');
  assert.match(planningPrompt,/Different businesses must not receive identical plans/);
  assert.match(planningPrompt,/Lead generation moves toward contact/);
});
test('D: capacity, consecutive days, phase coverage, CTA intensity and preparation dependencies',()=>{
  const p=fixture();p.days[0].tasks.push(p.days[0].tasks[0]);assert.throws(()=>validatePlan(p,2,1));
  for(const mutate of [
    p=>p.days[1].dayNumber=1,p=>p.phases[0].endDay=1,p=>p.days[0].phase='missing',
    p=>p.days[0].ctaIntensity=5,p=>p.preparation[0].requiredBeforeDay=3,
    p=>p.days[0].tasks=[],p=>p.days[0].tasks[0].why='',p=>p.days[1].decisionCriteria=null,
    p=>p.days[0].mission=''
  ]){const p=fixture();mutate(p);assert.throws(()=>validatePlan(p,2,1));}
});
test('E/F: unknown, absent and available proof remain distinct; exact descriptions/counts reach planning',()=>{
  assert.equal(buildPlanningInput(source).proofAssets,undefined);
  assert.equal(buildPlanningInput({...source,planningContext:{proofAssets:null}}).proofAssets,null);
  assert.deepEqual(buildPlanningInput({...source,planningContext:{proofAssets:[]}}).proofAssets,[]);
  const assets=[{type:'video_testimonial',description:'۸ رضایت ویدیویی واقعی',count:8}];
  assert.deepEqual(buildPlanningInput({...source,planningContext:{proofAssets:assets}}).proofAssets,assets);
  assert.match(planningPrompt,/NEVER invent its contents/);
  assert.doesNotMatch(planningPrompt,/No proof is provided in this MVP/);
  const p=fixture();p.phases[0].proofToUse=['۸ رضایت ویدیویی واقعی'];p.days[0].tasks[0].title='انتخاب و انتشار یکی از رضایت‌های واقعی مرتبط';p.days[0].tasks[0].requiredAsset='۸ رضایت ویدیویی واقعی';
  assert.equal(validatePlan(p,2,1).days[0].tasks[0].requiredAsset,assets[0].description);
});
test('G/H: known time objection, support conversion path and optional resources survive input and output',()=>{
  const context={objections:['وقت ندارم'],conversionPath:{action:'پیام به پشتیبانی',steps:['دریافت توضیح','پرداخت','ارسال رسید']},availableContentFormats:['متن'],previousLearnings:['توضیح زمان تمرین مهم بود']};
  const input=buildPlanningInput({...source,planningContext:context});
  assert.deepEqual(input.objections,context.objections);assert.deepEqual(input.conversionPath,context.conversionPath);
  assert.deepEqual(input.availableContentFormats,['متن']);assert.deepEqual(input.previousLearnings,context.previousLearnings);
  const p=validatePlan(fixture(),2,1);
  assert.match(p.days[1].mission,/وقت ندارم/);
  assert.ok(p.days.some(d=>d.tasks.some(t=>t.type==='FOLLOW_UP')));
  assert.equal(buildPlanningInput({...source,planningContext:{conversionPath:null}}).conversionPath,null);
  assert.throws(()=>PlanningContextSchema.parse({proofAssets:[{type:'test',count:-1}]}));
});
test('new output is v2-only while existing v1 saved output remains readable',()=>{
  const old={strategy:'قدیمی',bigIdea:'قدیمی',coreMessage:'قدیمی',assumptions:[],phases:[{name:'اجرا',objective:'اجرا',startDay:1,endDay:1}],preparation:[],days:[{dayNumber:1,phase:'اجرا',mission:'اجرا',objective:'اجرا',decisionPoint:false,tasks:[{title:'بررسی پیام',type:'SUPPORT',why:'رفع مانع'}]}]};
  assert.throws(()=>validatePlan(old,1,1));assert.equal(validateStoredPlan(old,1,1).strategy,'قدیمی');
});

test('targeted planning instructions cover proof, distinct objections, CTA, workload, trust and final review',()=>{
  for(const instruction of [/actively incorporate their selection\/use/,/40 real text testimonials and 8 real video testimonials/,/Prioritize materially different objections separately/,/Intensity must materially affect task.cta/,/not a required count or a default of exactly one/,/TRUST IS NOT A PRODUCT COMPONENT LIST/,/make them conditional/,/Never assume warm leads exist/,/Never say "بقیه را رها کن"/,/strategically meaningful unconfirmed assumptions/,/not mechanically every N days/,/final day.*normal future-adjustment/,/voice can clarify/,/Every day must have mission-specific observable successSignals/])assert.match(planningPrompt,instruction);
});

test('planning accepts the full product length allowed by campaign setup without truncation',()=>{
  const product='م'.repeat(5000);assert.equal(buildPlanningInput({...source,product}).product,product);
  assert.throws(()=>buildPlanningInput({...source,product:product+'م'}));
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const {MethodsService}=require('../apps/api/dist/src/ai/methods.service');
const {methodHash,methodAllowed,acceptedMethod,validateMethod,methodGuide}=require('../apps/api/dist/src/ai/campaign-methods');
const {buildPlanningInput}=require('../apps/api/dist/src/ai/planning-context');
const {CreateCampaignSchema}=require('../apps/api/dist/src/campaigns.dto');
const {PlanningService}=require('../apps/api/dist/src/ai/planning.service');
const {ContentService}=require('../apps/api/dist/src/ai/content.service');
const {CampaignsService}=require('../apps/api/dist/src/campaigns.service');
const {fixture}=require('./planning-fixtures.cjs');
function option(id){return {id,components:[],title:methodGuide[id].title,journey:methodGuide[id].stages.join('، '),reasons:['متناسب با امکانات ثبت‌شده'],preparation:methodGuide[id].requirements,assumptions:[],limitations:[]};}
function setup(overrides={}){
 const c={id:'c',name:'کمپین',status:'DRAFT',updatedAt:new Date('2026-10-01'),businessType:'آموزش',campaignType:'فروش',product:'دوره',audience:'مشتری',problem:null,outcome:null,target:null,duration:2,maxContentPerDay:1,offer:{kind:'عادی',details:'',regularPrice:'0'},salesPath:{action:'پیام',details:''},aiPlan:null,planningContext:{methodRequired:true,executionProfile:{platform:'تلگرام',familiarity:'aware',privateReplies:'yes',onlineSession:'yes',calls:'no',audienceSize:0,averageViews:null}},...overrides};
 const changes=[];let calls=0;const db={campaign:{findUnique:async()=>structuredClone(c),update:async({data})=>{Object.assign(c,data);if(data.aiPlan===require('../apps/api/node_modules/@prisma/client').Prisma.DbNull)c.aiPlan=null;c.updatedAt=new Date(c.updatedAt.getTime()+1);return c;}},campaignChange:{create:async({data})=>{changes.push(data);}},$queryRaw:async()=>[]};db.$transaction=fn=>fn(db);
 const provider={json:async()=>{calls++;return {primary:option('webinar'),alternative:option('private'),questions:[]};}};
 return {c,db,provider,service:new MethodsService(db,provider),changes,calls:()=>calls};
}
test('beginner gets understandable primary/alternative once; acceptance persists without activation and reaches planning input',async()=>{
 const t=setup();const a=await t.service.recommend('c');assert.match(a.report.primary.title,/جلسه آموزشی/);assert.equal(a.report.alternative.id,'private');
 await t.service.recommend('c');assert.equal(t.calls(),1);
 await t.service.accept('c',{sourceHash:a.sourceHash,choice:'primary'});assert.equal(t.c.status,'DRAFT');assert.equal(acceptedMethod(t.c).id,'webinar');assert.equal(t.changes.length,1);
 assert.equal(buildPlanningInput(t.c).selectedMethod.id,'webinar');assert.equal(buildPlanningInput(t.c).executionProfile.platform,'تلگرام');
});
test('definite lack and unknown capabilities exclude dependent methods; zero remains known',()=>{
 const t=setup();t.c.planningContext.executionProfile.onlineSession='no';assert.equal(methodAllowed('webinar',t.c),false);t.c.planningContext.executionProfile.onlineSession='unknown';assert.equal(methodAllowed('webinar',t.c),false);
 t.c.planningContext.executionProfile.privateReplies='no';assert.equal(methodAllowed('private',t.c),false);assert.equal(methodAllowed('challenge',t.c),false);assert.equal(methodAllowed('flash',t.c),false);
 assert.throws(()=>validateMethod({...option('hybrid'),components:['main','webinar']},t.c));
 assert.equal(buildPlanningInput(t.c).executionProfile.audienceSize,0);assert.equal(buildPlanningInput(t.c).executionProfile.averageViews,null);
});
test('recommendation rejects incompatible model output; missing facts have at most three questions',async()=>{
 const t=setup();t.c.planningContext.executionProfile.onlineSession='no';await assert.rejects(()=>t.service.recommend('c'),/معتبر نبود/);assert.equal(t.c.planningContext.methodState,undefined);
 t.provider.json=async()=>({primary:null,alternative:null,questions:['قیمت محصول چقدر است؟']});assert.equal((await t.service.recommend('c')).report.questions.length,1);
 t.c.product='محصول تازه';t.provider.json=async()=>({primary:null,alternative:null,questions:['۱','۲','۳','۴']});await assert.rejects(()=>t.service.recommend('c'),/معتبر نبود/);
});
test('duplicate requests are single flight; stale AI response never overwrites newer edit',async()=>{
 const t=setup();let release;t.provider.json=()=>new Promise(r=>release=r);const pending=t.service.recommend('c');await new Promise(r=>setImmediate(r));await assert.rejects(()=>t.service.recommend('c'),/حال ساخت/);
 t.c.updatedAt=new Date(t.c.updatedAt.getTime()+5);release({primary:option('main'),alternative:null,questions:[]});await assert.rejects(()=>pending,/تغییر کرده/);assert.equal(t.c.planningContext.methodState,undefined);
});
test('effective edits invalidate cached report and accepted method; stale acceptance fails',async()=>{
 const t=setup();const report=await t.service.recommend('c');await t.service.accept('c',{sourceHash:report.sourceHash,choice:'alternative'});const hash=methodHash(t.c);t.c.duration=7;
 assert.notEqual(methodHash(t.c),hash);assert.equal(acceptedMethod(t.c),null);assert.equal((await t.service.get('c')).stale,true);await assert.rejects(()=>t.service.accept('c',{sourceHash:hash,choice:'primary'}),/تغییر کرده/);
});
test('manual choice uses same capability guards, makes no AI call, and legacy method stays unknown',async()=>{
 const t=setup();await t.service.accept('c',{sourceHash:methodHash(t.c),choice:'manual',method:'hybrid',components:['main','private']});assert.equal(t.calls(),0);assert.equal(acceptedMethod(t.c).id,'hybrid');
 const legacy=setup({planningContext:{}});assert.equal(acceptedMethod(legacy.c),null);assert.equal(buildPlanningInput(legacy.c).selectedMethod,undefined);
 const fields={name:'قدیمی',businessType:'آموزش',campaignType:'فروش',product:'دوره',duration:2,offer:{kind:'عادی',details:''},salesPath:{action:'پیام',details:''}};assert.equal(CreateCampaignSchema.parse(fields).methodRequired,undefined);assert.equal(CreateCampaignSchema.parse({...fields,methodState:{accepted:option('webinar')}}).methodState,undefined);
});
test('webinar and private methods send distinct executable lifecycle guidance to planning, never reselect',async()=>{
 const inputs=[];
 for(const id of ['webinar','private']){const t=setup();await t.service.accept('c',{sourceHash:methodHash(t.c),choice:'manual',method:id});t.provider.json=async(prompt,input)=>{inputs.push({prompt,input});const plan=fixture();plan.strategy=input.selectedMethod.journey;plan.preparation=[{title:methodGuide[id].stages[0],why:'پیش‌نیاز روش',requiredBeforeDay:1}];plan.days[0].mission=methodGuide[id].stages[1];plan.days[1].tasks[0].title=methodGuide[id].stages.at(-1);return plan;};await new PlanningService(t.db,t.provider).generate('c');assert.equal(t.c.aiPlan.strategy,acceptedMethod(t.c).journey);}
 assert.notEqual(inputs[0].input.selectedMethod.journey,inputs[1].input.selectedMethod.journey);assert.match(inputs[0].prompt,/registration, invitations, reminders/);assert.match(inputs[1].prompt,/private conversations and sales follow-up/);assert.match(inputs[0].prompt,/never reselect/);
});
test('new drafts require accepted method while old drafts remain plannable',async()=>{
 const t=setup();await assert.rejects(()=>new PlanningService(t.db,t.provider).generate('c'),/روش اجرا/);assert.equal(t.calls(),0);
 const legacy=setup({planningContext:{}});legacy.provider.json=async()=>fixture();await new PlanningService(legacy.db,legacy.provider).generate('c');assert.ok(legacy.c.aiPlan);
});
test('content receives selected method, platform and day/task; voice/video remain script-only',async()=>{
 const t=setup();await t.service.accept('c',{sourceHash:methodHash(t.c),choice:'manual',method:'private'});t.c.status='ACTIVE';
 const task={id:'t',type:'CONTENT',archived:false,locked:false,status:'PENDING',content:null,updatedAt:new Date(),title:'پیگیری خصوصی',format:'ویس',day:{campaignId:'c',dayNumber:1,mission:'گفت‌وگو',objective:'پاسخ به سؤال',campaign:t.c}};t.db.task={findUnique:async()=>task,updateMany:async()=>({count:1})};
 t.provider.json=async(prompt,input)=>{assert.equal(input.campaign.selectedMethod.id,'private');assert.equal(input.campaign.executionProfile.platform,'تلگرام');assert.equal(input.day.mission,'گفت‌وگو');assert.equal(input.task.title,'پیگیری خصوصی');assert.match(prompt,/voice\/video\/demo mean a labeled script/);return {content:'سناریوی ویس برای پاسخ‌گویی'};};
 await new ContentService(t.db,t.provider).generate('t',{});
});
test('setup round-trips new fields, preserves same-input cache, and marks effective edits for review without AI',async()=>{
 const t=setup();const report=await t.service.recommend('c');await t.service.accept('c',{sourceHash:report.sourceHash,choice:'primary'});
 const fields={name:'نام تازه',businessType:t.c.businessType,campaignType:t.c.campaignType,product:t.c.product,audience:t.c.audience,duration:t.c.duration,maxContentPerDay:1,offer:t.c.offer,salesPath:t.c.salesPath,methodRequired:true,executionProfile:t.c.planningContext.executionProfile};
 const service=new CampaignsService(t.db);await service.setup('c',{expectedUpdatedAt:t.c.updatedAt.toISOString(),fields});assert.equal(acceptedMethod(t.c).id,'webinar');await t.service.recommend('c');assert.equal(t.calls(),1);
 await service.setup('c',{expectedUpdatedAt:t.c.updatedAt.toISOString(),fields:{...fields,executionProfile:{...fields.executionProfile,onlineSession:'no'}}});assert.equal(acceptedMethod(t.c),null);assert.equal((await t.service.get('c')).stale,true);assert.equal(t.c.planningContext.executionProfile.onlineSession,'no');assert.equal(t.calls(),1);
});

test('phone-only backstage is eligible, unknown is never consent, and the selected channel reaches planning',async()=>{
 const t=setup();t.c.planningContext.executionProfile.privateReplies='no';t.c.planningContext.executionProfile.calls='yes';
 assert.equal(methodAllowed('private',t.c),true);await t.service.accept('c',{sourceHash:methodHash(t.c),choice:'manual',method:'private'});
 assert.equal(buildPlanningInput(t.c).executionProfile.calls,'yes');assert.equal(acceptedMethod(t.c).id,'private');
 const unknown=setup();unknown.c.planningContext.executionProfile.privateReplies='unknown';unknown.c.planningContext.executionProfile.calls='unknown';
 assert.equal(methodAllowed('private',unknown.c),false);await assert.rejects(()=>unknown.service.accept('c',{sourceHash:methodHash(unknown.c),choice:'manual',method:'private'}),/سازگار نیست/);
});
test('inline clarification saves only requested fields with version guards and without extra AI calls',async()=>{
 const t=setup();let calls=0;t.provider.json=async(_prompt,_input,options)=>{calls++;assert.equal(options.maxOutputTokens,2400);return {primary:null,alternative:null,questions:[{field:'calls',question:'امکان تماس داری؟'},{field:'price',question:'قیمت واقعی چقدر است؟'}]};};
 const report=await t.service.recommend('c');await t.service.recommend('c');assert.equal(calls,1);
 await assert.rejects(()=>t.service.answers('c',{sourceHash:report.sourceHash,answers:{audience:'داده خارج از سؤال'}}),/فقط پاسخ/);
 await t.service.answers('c',{sourceHash:report.sourceHash,answers:{calls:'yes',price:'0'}});assert.equal(calls,1);assert.equal(t.c.offer.regularPrice,'0');assert.equal(t.c.planningContext.executionProfile.calls,'yes');assert.equal((await t.service.get('c')).report,null);
 assert.deepEqual(t.c.planningContext.methodQuestionsAnswered,['calls','price']);await assert.rejects(()=>t.service.answers('c',{sourceHash:report.sourceHash,answers:{calls:'no'}}),/تغییر کرده/);
});
test('prompt/guide changes invalidate the old recommendation fingerprint while active accepted plans stay usable',()=>{
 const {methodInput,methodPrompt,METHOD_GUIDE_VERSION,METHOD_PROMPT_VERSION}=require('../apps/api/dist/src/ai/campaign-methods');
 const t=setup();const legacyHash=require('node:crypto').createHash('sha256').update(JSON.stringify(methodInput(t.c))).digest('hex');assert.notEqual(methodHash(t.c),legacyHash);assert.ok(METHOD_GUIDE_VERSION);assert.ok(METHOD_PROMPT_VERSION);assert.match(methodPrompt,/clarifiedFields/);
 t.c.planningContext.methodState={sourceHash:legacyHash,accepted:option('private')};assert.equal(acceptedMethod(t.c),null);t.c.status='ACTIVE';assert.equal(acceptedMethod(t.c).id,'private');
});
test('all new business goals round-trip through the existing goal contract without inferring methods',()=>{
 for(const campaignType of ['لیدگیری (دریافت اطلاعات تماس)','پرورش مخاطب','فروش مجدد به مشتریان قبلی','ارتقای خرید','وفادارسازی']){
  const c=setup().c;const fields=CreateCampaignSchema.parse({...c,campaignType,audience:'مخاطب',problem:undefined,outcome:undefined,target:undefined,startDate:undefined});assert.equal(fields.campaignType,campaignType);assert.equal(fields.methodState,undefined);
 }
});

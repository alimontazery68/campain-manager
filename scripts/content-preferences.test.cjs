const {test}=require('node:test'),assert=require('node:assert/strict');
const {ContentService}=require('../apps/api/dist/src/ai/content.service');
function setup(overrides={}){
 const campaign={id:'c',status:'ACTIVE',businessType:'آموزش',campaignType:'فروش',product:'دوره واقعی',audience:'مخاطب واقعی',problem:null,outcome:null,duration:2,target:null,maxContentPerDay:1,offer:{kind:'بدون تخفیف',details:''},salesPath:{action:'پیام',details:'پشتیبانی'},planningContext:{proofAssets:[{type:'text',description:'شاهد واقعی',count:2}],objections:['وقت ندارم'],availableContentFormats:['متن','ویس']},aiPlan:{coreMessage:'پیام تأییدشده'}};
 const task={id:'t',dayId:'d',type:'CONTENT',status:'PENDING',archived:false,locked:false,updatedAt:new Date(),content:null,format:'متن',title:'معرفی',why:'شناخت روش',cta:'پیام',objective:'آگاهی',metadata:{topic:'تمرین'},day:{campaignId:'c',campaign,dayNumber:1,mission:'معرفی روش',objective:'آگاهی',phase:'شناخت',guidance:{ctaIntensity:1}},...overrides};
 const calls=[],writes=[];const db={task:{findUnique:async()=>task,updateMany:async args=>{writes.push(args);task.content=args.data.content;return {count:1};}},campaign:{findUnique:async()=>campaign},$queryRaw:async()=>[]};db.$transaction=fn=>fn(db);
 const service=new ContentService(db,{json:async(prompt,input)=>{calls.push({prompt,input});return {content:'متن تازه برای معرفی روش؛ برای آشنایی بیشتر پیام بده.'};}});
 return {service,task,calls,writes};
}
test('selected preferences reach the actual provider input alongside real campaign evidence and day guidance',async()=>{
 const c=setup();const preferences={tone:'formal',format:'video',instructions:'روی زمان کم تمرین تأکید کن'};
 await c.service.generate('t',{action:'generate',preferences});assert.equal(c.calls.length,1);
 const {input,prompt}=c.calls[0];assert.deepEqual(input.generationPreferences,{...preferences,effectiveFormat:'ویدیو'});
 assert.equal(input.task.format,'متن');assert.equal(input.campaign.proofAssets[0].description,'شاهد واقعی');assert.equal(input.guidance.ctaIntensity,1);
 assert.match(prompt,/Never fabricate testimonials/);assert.match(prompt,/Never claim that an audio, image or video file was created/);
 assert.deepEqual(Object.keys(c.writes[0].data),['content']);assert.equal(c.task.format,'متن');
});
test('legacy requests use task defaults; regeneration and revisions also receive preferences',async()=>{
 const legacy=setup();await legacy.service.generate('t',{action:'generate'});
 assert.deepEqual(legacy.calls[0].input.generationPreferences,{tone:'campaign',format:'task',effectiveFormat:'متن',instructions:''});
 for(const action of ['regenerate','friendly','direct']){const c=setup({content:'متن اولیه'});await c.service.generate('t',{action,preferences:{tone:'energetic',format:'voice'}});assert.equal(c.calls[0].input.generationPreferences.effectiveFormat,'ویس');}
});
test('invalid preferences and protected tasks never call AI; manual saves remain independent',async()=>{
 for(const preferences of [{tone:'invalid'},{format:'file'},{instructions:'x'.repeat(1501)},{tone:'formal',unknown:true}]){const c=setup();await assert.rejects(()=>c.service.generate('t',{preferences}));assert.equal(c.calls.length,0);}
 for(const change of [{locked:true},{archived:true},{status:'DONE'},{status:'SKIPPED'}]){const c=setup(change);await assert.rejects(()=>c.service.generate('t',{preferences:{tone:'formal'}}));assert.equal(c.calls.length,0);assert.equal(c.writes.length,0);}
 const c=setup();await c.service.save('t',{content:'متن دستی محفوظ',expectedContent:null});assert.equal(c.calls.length,0);assert.equal(c.task.content,'متن دستی محفوظ');
});

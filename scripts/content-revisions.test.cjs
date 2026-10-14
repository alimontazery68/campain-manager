const test=require('node:test');
const assert=require('node:assert/strict');
const {validateRevision,revisionBrief,buildContentPrompt}=require('../apps/api/dist/src/ai/content');
const original=Array.from({length:40},(_,i)=>'واژه'+i).join(' ');
test('shortening has a measurable budget and rejects insufficient reduction',()=>{
  assert.equal(revisionBrief('shorter',original).maxWords,26);
  assert.throws(()=>validateRevision('shorter',original,original.split(' ').slice(0,35).join(' ')));
  assert.doesNotThrow(()=>validateRevision('shorter',original,original.split(' ').slice(0,25).join(' ')));
});
test('punctuation-only and minimal rewrites cannot replace saved content',()=>{
  for(const action of ['regenerate','friendly','direct']) {
    assert.throws(()=>validateRevision(action,original,original+'!'));
    assert.throws(()=>validateRevision(action,original,original.replace('واژه20','تغییر')));
    assert.doesNotThrow(()=>validateRevision(action,original,original.split(' ').reverse().join(' ')));
  }
});
test('each operation has its own brief and keeps factual guardrails',()=>{
  assert.match(buildContentPrompt('regenerate'),/different opening hook AND a different narrative structure/);
  assert.match(buildContentPrompt('friendly'),/Replace formal\/robotic constructions throughout/);
  assert.match(buildContentPrompt('direct'),/At low CTA intensity keep engagement\/education/);
  assert.match(buildContentPrompt('shorter'),/revisionBrief.maxWords/);
  for(const action of ['regenerate','shorter','friendly','direct'])assert.match(buildContentPrompt(action),/Never fabricate testimonials/);
});

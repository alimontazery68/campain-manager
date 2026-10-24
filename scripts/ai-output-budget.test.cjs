const {test}=require('node:test'),assert=require('node:assert/strict');
const {DeepSeekProvider}=require('../apps/api/dist/src/ai/deepseek');
test('method output budget is independent of planning; incomplete output is rejected without retries',async()=>{
 const previousFetch=global.fetch,key=process.env.DEEPSEEK_API_KEY,mock=process.env.AI_MOCK_MODE;let requests=[];
 process.env.DEEPSEEK_API_KEY='test-only';delete process.env.AI_MOCK_MODE;
 try{
  global.fetch=async(_url,args)=>{requests.push(JSON.parse(args.body));return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})};};
  const provider=new DeepSeekProvider();await provider.json('method',{}, {maxOutputTokens:2400});await provider.json('plan',{});assert.deepEqual(requests.map(r=>r.max_tokens),[2400,8000]);
  global.fetch=async()=>{requests.push({});return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{"unfinished"'}}]})};};
  await assert.rejects(()=>provider.json('method',{}, {maxOutputTokens:2400}),/ناقص بود/);assert.equal(requests.length,3);
 }finally{global.fetch=previousFetch;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;if(mock===undefined)delete process.env.AI_MOCK_MODE;else process.env.AI_MOCK_MODE=mock;}
});

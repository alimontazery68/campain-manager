const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {AuthService}=require('../apps/api/dist/src/auth.service');
for(const designated of [false,true])test('unowned campaigns are assigned only to configured legacy owner: '+designated,async()=>{
 const before=process.env.LEGACY_CAMPAIGN_OWNER_PHONE;
 const phone='09120000000';process.env.LEGACY_CAMPAIGN_OWNER_PHONE=designated?phone:'';
 let assignments=0;
 const db={user:{findUnique:async()=>({id:'user',phone,otpCodes:[{id:'otp',codeHash:createHash('sha256').update('12345').digest('hex'),expiresAt:new Date(Date.now()+60000),attempts:0}]})},otpCode:{update:async()=>({})},campaign:{updateMany:async()=>{assignments++;}}};
 const length=process.env.OTP_LENGTH;process.env.OTP_LENGTH='5';
 try{await new AuthService(db).verifyOtp({phone,code:'12345'});assert.equal(assignments,designated?1:0);}finally{if(before===undefined)delete process.env.LEGACY_CAMPAIGN_OWNER_PHONE;else process.env.LEGACY_CAMPAIGN_OWNER_PHONE=before;if(length===undefined)delete process.env.OTP_LENGTH;else process.env.OTP_LENGTH=length;}
});

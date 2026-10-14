const {createHmac,randomUUID}=require('node:crypto');
async function authenticate(context,db){
 const user=await db.user.create({data:{phone:'09'+String(BigInt('0x'+randomUUID().replaceAll('-',''))%1000000000n).padStart(9,'0')}});
 const payload=Buffer.from(JSON.stringify({sub:user.id,exp:Date.now()+3600000})).toString('base64url');
 const token=payload+'.'+createHmac('sha256',process.env.AUTH_SESSION_SECRET||'change-me').update(payload).digest('base64url');
 await context.addCookies([{name:'campaign_session',value:token,url:process.env.TEST_WEB_URL||'http://localhost:3000'}]);
 return user;
}
module.exports={authenticate};

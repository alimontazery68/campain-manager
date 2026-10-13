import 'reflect-metadata'; import { NestFactory } from '@nestjs/core'; import { AppModule } from './app.module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
async function bootstrap(){
 const app=await NestFactory.create(AppModule);
 app.enableCors({origin:(process.env.WEB_ORIGIN||`http://localhost:${process.env.WEB_PORT||3000}`).split(','),methods:['GET','POST','PATCH','OPTIONS']});
 const buckets=new Map<string,{count:number;reset:number}>();
 app.use((req:any,res:any,next:()=>void)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST'&&/(\/context|\/plan|\/analysis|\/content|\/learning)$/.test(req.path)){
   const now=Date.now(),key=req.socket.remoteAddress||'local';let bucket=buckets.get(key);
   if(!bucket||bucket.reset<now){bucket={count:0,reset:now+60000};buckets.set(key,bucket);}
   if(++bucket.count>Number(process.env.AI_REQUESTS_PER_MINUTE||20)){res.status(429).json({message:'درخواست‌های AI زیاد شده؛ یک دقیقه صبر کن.'});return;}
   if(buckets.size>1000)for(const [ip,value] of buckets)if(value.reset<now)buckets.delete(ip);
  }next();
 });
 await app.listen(process.env.API_PORT||4000,process.env.API_HOST||'127.0.0.1');
}
bootstrap();

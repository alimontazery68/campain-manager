'use client';
import { useEffect,useState } from 'react';
import { request } from './api';
type Field='campaignType'|'audience'|'problem'|'outcome';
type Input={businessType:string;campaignType:string;product:string;audience:string;problem:string;outcome:string;salesPath:string};
type Help={suggestions:{field:Field;value:string;reason:string}[];questions:{field:string;question:string;critical:boolean}[]};
export default function ContextHelp({input,apply}:{input:Input;apply:(field:Field,value:string)=>void}){
 const [data,setData]=useState<Help|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key='campaign-context-help',identity=JSON.stringify([input.product,input.businessType]);
 useEffect(()=>{setData(null);try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.identity===identity)setData(saved.data);}catch{}},[identity]);
 async function help(){setBusy(true);setError('');try{const d=await request<Help>('campaigns/context',{method:'POST',body:JSON.stringify(input)});setData(d);try{localStorage.setItem(key,JSON.stringify({identity,data:d}));}catch{}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details><summary>نمی‌دانم — کمکم کن</summary><p>پیشنهادها قطعی نیستند؛ فقط با تأیید تو وارد فرم می‌شوند. این دکمه درخواست هزینه‌دار AI دارد.</p><button className="outline" disabled={busy||input.product.trim().length<2} onClick={()=>void help()}>{busy?'در حال تهیه پیشنهاد…':data?'پیشنهاد تازه؛ درخواست AI جدید':'برایم پیشنهاد بساز'}</button>{error&&<p className="error" role="alert">{error}</p>}{data?.suggestions.map(s=><article key={s.field}><p>{({campaignType:'هدف کمپین',audience:'مخاطب پیشنهادی',problem:'مشکل پیشنهادی',outcome:'نتیجه مطلوب'} as Record<string,string>)[s.field]}: {s.value}</p><small>{s.reason}</small><button className="outline" disabled={busy} onClick={()=>apply(s.field,s.value)}>این پیشنهاد را تأیید می‌کنم</button></article>)}{data?.questions.map(q=><p key={q.field}>{q.critical?'برای مسیر قابل اجرا لازم است: ':'اگر می‌دانی در فرم تکمیل کن: '}{q.question}</p>)}{data&&!data.suggestions.length&&!data.questions.length&&<p>اطلاعات فعلی برای ادامه کافی است.</p>}</details>;
}

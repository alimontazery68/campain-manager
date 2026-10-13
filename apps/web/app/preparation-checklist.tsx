'use client';
import { useEffect,useState } from 'react';
import { request } from './api';
type Item={id:string;title:string;why:string;requiredBeforeDay:number|null;completed:boolean;updatedAt:string};
type Data={status:string;initialized:boolean;items:Item[]};
type Planned={title:string;why:string;requiredBeforeDay?:number};
const localDate=(value:string|Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export default function PreparationChecklist({id,status,days,planned,changed}:{id:string;status:string;days:{dayNumber:number;date:string}[];planned:Planned[];changed?:()=>Promise<void>}){
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setData(null);setError('');request<Data>('campaigns/'+id+'/preparation').then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,status]);
 async function refresh(){setBusy('read');setError('');try{setData(await request<Data>('campaigns/'+id+'/preparation'));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function initialize(){setBusy('init');setError('');try{setData(await request<Data>('campaigns/'+id+'/preparation',{method:'POST'}));await changed?.();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function toggle(item:Item){if(busy)return;setBusy(item.id);setError('');try{const saved=await request<Item>('campaigns/preparation/'+item.id,{method:'PATCH',body:JSON.stringify({completed:!item.completed,expectedCompleted:item.completed,expectedUpdatedAt:item.updatedAt})});setData(d=>d?{...d,items:d.items.map(t=>t.id===saved.id?saved:t)}:d);await changed?.();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 const today=localDate(new Date());
 return <section className="day-card"><h2>آماده‌سازی کمپین</h2><p>این کارها از طرح تأییدشده آمده‌اند. ثبت وضعیت درخواست AI ندارد؛ وضعیت آماده‌سازی از کارهای روزانه جداست.</p>
 {error&&<p className="error" role="alert">{error} <button className="outline" disabled={!!busy} onClick={()=>void refresh()}>خواندن دوباره</button></p>}
 {!data&&!error&&<p role="status">در حال خواندن چک‌لیست…</p>}
 {data&&!data.initialized&&<><p>برای این کمپین قدیمی هنوز چک‌لیست قابل پیگیری ساخته نشده است.</p>{status==='ACTIVE'?<button className="outline" disabled={!!busy} onClick={()=>void initialize()}>{busy==='init'?'در حال ذخیره…':'ساخت چک‌لیست از همین طرح تأییدشده'}</button>:<p>کمپین پایان یافته است؛ موارد طرح فقط برای مرور نمایش داده می‌شوند.</p>}{planned.map((p,i)=><article key={i}><h3>{p.title}</h3><p>{p.why}</p><small>{p.requiredBeforeDay?'پیش از روز '+p.requiredBeforeDay.toLocaleString('fa-IR'):'روز مورد نیاز در طرح قدیمی مشخص نشده است.'}</small></article>)}</>}
 {data?.initialized&&<><p>{data.items.filter(t=>t.completed).length.toLocaleString('fa-IR')} از {data.items.length.toLocaleString('fa-IR')} مورد آماده شده</p>{!data.items.length&&<p>در طرح تأییدشده مورد آماده‌سازی جداگانه‌ای وجود ندارد.</p>}
 {data.items.map(item=>{const day=days.find(d=>d.dayNumber===item.requiredBeforeDay),due=day?localDate(day.date):null;return <article className={'task '+(item.completed?'is-done':'')} key={item.id}><div className="task-body"><h3>{item.title}</h3><p>{item.why}</p><small>{item.requiredBeforeDay?'لازم پیش از روز '+item.requiredBeforeDay.toLocaleString('fa-IR')+(day?' · '+new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium'}).format(new Date(day.date)):''):'روز مورد نیاز در طرح قدیمی مشخص نشده است.'}</small>{!item.completed&&due&&due<=today&&status==='ACTIVE'&&<p className="error">این مورد برای روزی که رسیده لازم است و هنوز آماده نشده. قبل از اجرای کارهای وابسته بررسی‌اش کن.</p>}<p>{item.completed?'آماده شده':'آماده نشده'}</p></div>{status==='ACTIVE'&&data.status==='ACTIVE'&&<button className="outline" disabled={!!busy} onClick={()=>void toggle(item)}>{busy===item.id?'در حال ثبت…':item.completed?'برگرداندن به آماده‌نشده':'آماده شد'}</button>}</article>;})}</>}
 </section>;
}

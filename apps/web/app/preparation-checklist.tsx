'use client';
import { useEffect,useState } from 'react';
import { request } from './api';
import { CalendarClock, Check, CheckCircle2, CircleDashed, ClipboardCheck, RotateCcw, AlertCircle } from 'lucide-react';
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
 const completed=data?.items.filter(t=>t.completed).length??0;
 function card(item:{title:string;why:string;requiredBeforeDay?:number|null;id?:string;completed?:boolean},index:number){
  const day=days.find(d=>d.dayNumber===item.requiredBeforeDay),due=day?localDate(day.date):null;
  const overdue=item.completed===false&&due!==null&&due<=today&&status==='ACTIVE';
  const known=item.completed!==undefined;
  return <article className={'preparation-card'+(item.completed?' is-ready':'')+(overdue?' needs-attention':'')} key={item.id??index}>
   <div className="preparation-card-top"><span className="preparation-item-icon">{item.completed?<CheckCircle2 size={20}/>:<CircleDashed size={20}/>}</span><span className={'preparation-badge '+(item.completed?'ready':overdue?'due':'waiting')}>{item.completed?'آماده شده':!known?'ثبت‌نشده':overdue?'نیازمند آماده‌سازی':'آماده نشده'}</span></div>
   <h3>{item.title}</h3><p className="preparation-reason">{item.why}</p>
   <div className="preparation-deadline"><CalendarClock size={15}/><span>{item.requiredBeforeDay?'پیش از روز '+item.requiredBeforeDay.toLocaleString('fa-IR')+(day?' · '+new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium'}).format(new Date(day.date)):''):'زمان آماده‌سازی مشخص نشده'}</span></div>
   {overdue&&<p className="preparation-warning"><AlertCircle size={14}/><span>پیش از اجرای کار وابسته آماده شود.</span></p>}
   {known&&status==='ACTIVE'&&data?.status==='ACTIVE'&&<button className={'outline preparation-toggle'+(item.completed?' undo':'')} disabled={!!busy} onClick={()=>void toggle(item as Item)}>{item.completed?<RotateCcw size={14}/>:<Check size={15}/>}<span>{busy===item.id?'در حال ثبت…':item.completed?'برگرداندن به آماده‌نشده':'آماده شد'}</span></button>}
  </article>;
 }
 return <section className="day-card preparation-panel"><div className="preparation-heading"><div className="preparation-title"><span className="icon-box"><ClipboardCheck size={21}/></span><div><h2>آماده‌سازی کمپین</h2><p>پیش‌نیازهای اجرا را آماده و وضعیتشان را ثبت کن.</p></div></div>{data?.initialized&&<span className="preparation-count">{completed.toLocaleString('fa-IR')} از {data.items.length.toLocaleString('fa-IR')} آماده</span>}</div>
 {error&&<p className="error" role="alert">{error} <button className="outline" disabled={!!busy} onClick={()=>void refresh()}>خواندن دوباره</button></p>}
 {!data&&!error&&<p role="status">در حال خواندن چک‌لیست…</p>}
 {data&&!data.initialized&&<><p className="wizard-hint">چک‌لیست قابل پیگیری هنوز ساخته نشده است.</p>{status==='ACTIVE'?<button className="outline" disabled={!!busy} onClick={()=>void initialize()}>{busy==='init'?'در حال ذخیره…':'ساخت چک‌لیست از همین طرح تأییدشده'}</button>:<p className="wizard-hint">کمپین پایان یافته است؛ موارد طرح فقط برای مرور نمایش داده می‌شوند.</p>}<div className="preparation-grid">{planned.map(card)}</div></>}
 {data?.initialized&&<>{!data.items.length?<p className="wizard-hint">پیش‌نیاز جداگانه‌ای در این طرح ثبت نشده است.</p>:<div className="preparation-grid">{data.items.map(card)}</div>}</>}
 </section>;
}

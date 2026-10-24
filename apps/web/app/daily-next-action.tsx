'use client';
import {ArrowLeft,CheckCircle2,ListChecks,Play} from 'lucide-react';
import type {Campaign,Day,Task} from './campaign-types';
import {nextDailyWork} from './execution-next';
export default function DailyNextAction({campaign,day,start,prepare,results}:{campaign:Campaign;day:Day;start:(t:Task)=>void;prepare:()=>void;results:()=>void}){
 const work=nextDailyWork(campaign,day);
 if(campaign.status!=='ACTIVE')return null;
 return <div className={"daily-next-action "+(work.missing.length?"is-blocked":work.task?"is-ready":"is-complete")}>{work.missing.length?<><p><ListChecks size={18}/>اول پیش‌نیازها را آماده کن</p><p>{work.missing.map(p=>p.title).join('، ')}</p><button className="primary" onClick={prepare}>آماده‌سازی روز<ArrowLeft size={16}/></button></>:work.task?<><p><Play size={18} aria-hidden="true"/>قدم بعدی: <strong>{work.task.title}</strong></p><button className="primary" onClick={()=>start(work.task!)}>شروع کار بعدی<ArrowLeft size={16}/></button></>:<><p><CheckCircle2 size={20}/>{work.tasks.length?'کار در انتظاری برای این روز باقی نمانده':'این روز هنوز کاری ندارد'}</p><p>{work.done.toLocaleString('fa-IR')} کار انجام‌شده{work.tasks.some(t=>t.status==='SKIPPED')?'؛ کارهای ردشده در جزئیات محفوظ‌اند.':''}</p><button className="primary" onClick={results}>{day.result?'مرور نتیجه و ادامه مسیر':'ثبت نتیجه روز'}</button></>}</div>;
}

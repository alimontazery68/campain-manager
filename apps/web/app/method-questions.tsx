'use client';
import {useEffect,useRef,useState} from 'react';
import {request} from './api';
export default function MethodQuestions({id,sourceHash,questions,onSaved}:{id:string;sourceHash:string;questions:({field:string;question:string}|string)[];onSaved:()=>Promise<void>}){
 const list=questions.map(q=>typeof q==='string'?{field:'constraints',question:q}:q);
 const [answers,setAnswers]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),key='method-answers-'+id+'-'+sourceHash;
 useEffect(()=>{try{setAnswers(JSON.parse(localStorage.getItem(key)||'{}'));}catch{}},[key]);
 function update(field:string,value:string){setAnswers(a=>{const next={...a,[field]:value};try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;});}
 async function save(){if(pending.current)return;if(list.some(q=>!answers[q.field]?.trim())){setError('به سؤال‌ها پاسخ بده؛ اطلاعات نامعلوم را حدس نزن.');return;}pending.current=true;setBusy(true);setError('');try{const submitted=Object.fromEntries(list.map(q=>[q.field,q.field==='formats'?answers[q.field]==='unknown'?null:answers[q.field]==='none'?[]:answers[q.field].split('،').map(v=>v.trim()).filter(Boolean):answers[q.field]]));await request('campaigns/'+id+'/method/answers',{method:'PATCH',body:JSON.stringify({sourceHash,answers:submitted})});try{localStorage.removeItem(key);}catch{}await onSaved();}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <form className="method-questions" onSubmit={e=>{e.preventDefault();void save();}}><h3>چند سؤال برای پیشنهاد مناسب‌تر</h3>{list.map((q,i)=>{
 const options=['privateReplies','calls','onlineSession'].includes(q.field)?[['yes','بله، امکانش را دارم'],['no','ندارم'],['unknown','نمی‌دانم']]:q.field==='familiarity'?[['unknown','نمی‌دانم'],['cold','هنوز آشنا نیست'],['aware','با برند آشناست'],['customer','قبلاً مشتری بوده است']]:q.field==='formats'?[['unknown','نمی‌دانم'],['none','هیچ قالبی ندارم'],['متن','متن'],['تصویر','تصویر'],['ویس','ویس'],['ویدیو','ویدیو'],['متن، تصویر، ویس، ویدیو','همه این قالب‌ها']]:null;
 return <label className="field" key={q.field+i}>{q.question}{options?<select value={answers[q.field]??''} disabled={busy} onChange={e=>update(q.field,e.target.value)}><option value="">انتخاب کن</option>{options.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:<textarea aria-label={q.question} rows={2} maxLength={q.field==='price'?200:q.field==='constraints'?2000:3000} value={answers[q.field]??''} disabled={busy} onChange={e=>update(q.field,e.target.value)}/>}</label>;
 })}{error&&<p role="alert" className="error">{error}</p>}<button type="submit" className="primary" disabled={busy}>{busy?'در حال ذخیره…':'ذخیره پاسخ‌ها'}</button><p className="wizard-hint">ذخیره پاسخ درخواست AI ندارد؛ سپس پیشنهاد تازه را با انتخاب خودت بگیر.</p></form>;
}

'use client';
import { useState } from 'react';
import { request } from './api';
type Plan={strategy:string;bigIdea:string;coreMessage:string;phases:{name:string;objective:string;[key:string]:unknown}[];days:unknown[];[key:string]:unknown};
export default function PlanEditor({id,plan,changed}:{id:string;plan:Plan;changed:()=>Promise<void>}){
 const [draft,setDraft]=useState(()=>structuredClone(plan)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await request('campaigns/'+id+'/plan',{method:'PATCH',body:JSON.stringify({expectedPlan:plan,plan:draft})});await changed();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="day-card"><summary>ویرایش طرح قبل از تأیید</summary>{(['strategy','bigIdea','coreMessage'] as const).map(key=><label className="field" key={key}>{{strategy:'مسیر کمپین',bigIdea:'ایده محوری',coreMessage:'پیام اصلی'}[key]}<textarea rows={3} maxLength={3000} value={draft[key]} disabled={busy} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}{draft.phases.map((p,i)=><label className="field" key={i}>هدف مرحله {p.name}<textarea value={p.objective} disabled={busy} onChange={e=>setDraft({...draft,phases:draft.phases.map((phase,j)=>j===i?{...phase,objective:e.target.value}:phase)})}/></label>)}<p>ویرایش فقط پیش از تأیید است و درخواست AI ندارد. اطلاعات واقعی محصول و پیشنهاد همچنان مبنای تولید محتوا هستند.</p>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy} onClick={()=>void save()}>ذخیره ویرایش طرح</button></details>;
}

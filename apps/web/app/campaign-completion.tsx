'use client';
import { useState } from 'react';
import { request } from './api';
type Summary={preparation?:{total:number;completed:number;initialized:boolean};totalDays:number;reportedDays:number;missingResultDays:number[];totalTasks:number;completedTasks:number;hasFutureDays:boolean;metrics:Record<string,{total:string|null;reportedDays:number}>;feedback:{dayNumber:number;text:string}[];limitations:string[]};
type Preview={sourceHash:string;status:string;summary:Summary;completion:{completedAt:string;learnings:string[];summary:Summary}|null};
const labels:Record<string,string>={views:'بازدید',leads:'سرنخ',warmLeads:'افراد علاقه‌مندِ هنوز خریدنکرده',sales:'فروش',revenue:'درآمد (تومان)'};
export default function CampaignCompletion({id,completed,onCompleted}:{id:string;completed:boolean;onCompleted:()=>Promise<void>}){
 const [preview,setPreview]=useState<Preview|null>(null),[learnings,setLearnings]=useState(''),[confirm,setConfirm]=useState(false),[early,setEarly]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){setBusy(true);setError('');try{const p=await request<Preview>('campaigns/'+id+'/completion');setPreview(p);setLearnings(p.completion?.learnings.join('\n')||'');setConfirm(false);setEarly(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function finish(){if(!preview||busy||!confirm)return;setBusy(true);setError('');try{await request('campaigns/'+id+'/complete',{method:'POST',body:JSON.stringify({sourceHash:preview.sourceHash,confirm:true,allowEarly:early,learnings:learnings.split('\n').map(s=>s.trim()).filter(Boolean)})});await onCompleted();await open();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const summary=preview?.completion?.summary||preview?.summary;
 return <section className="day-card"><h2>{completed?'جمع‌بندی کمپین پایان‌یافته':'پایان کمپین و ثبت آموخته‌ها'}</h2><p>این بخش هزینه AI ندارد. پایان کمپین، اجرای کارها و ویرایش نتایج را متوقف می‌کند؛ اطلاعات قبلی حذف نمی‌شوند.</p><button className="outline" disabled={busy} onClick={()=>void open()}>{busy?'در حال پردازش…':'مشاهده جمع‌بندی'}</button>
 {error&&<p className="error" role="alert">{error}</p>}
 {preview&&summary&&<><p>نتیجه ثبت‌شده: {summary.reportedDays.toLocaleString('fa-IR')} از {summary.totalDays.toLocaleString('fa-IR')} روز؛ کارهای انجام‌شده: {summary.completedTasks.toLocaleString('fa-IR')} از {summary.totalTasks.toLocaleString('fa-IR')}</p>
 <ul>{Object.entries(summary.metrics).map(([key,m])=><li key={key}>{labels[key]||key}: {m.total===null?'نامعلوم':BigInt(m.total).toLocaleString('fa-IR')} — گزارش در {m.reportedDays.toLocaleString('fa-IR')} روز</li>)}</ul>
 {!!summary.missingResultDays.length&&<p>روزهای بدون نتیجه: {summary.missingResultDays.map(n=>n.toLocaleString('fa-IR')).join('، ')}</p>}
 {summary.preparation&&<p>آماده‌سازی: {summary.preparation.initialized?summary.preparation.completed.toLocaleString('fa-IR')+' از '+summary.preparation.total.toLocaleString('fa-IR')+' مورد آماده شده':'چک‌لیست قابل پیگیری هنوز ساخته نشده است.'}</p>}
 <ul>{summary.limitations.map(s=><li key={s}>{s}</li>)}</ul>
 {summary.feedback.length>0&&<><h3>بازخوردهای ثبت‌شده</h3><ul>{summary.feedback.map(f=><li key={f.dayNumber}>روز {f.dayNumber.toLocaleString('fa-IR')}: {f.text}</li>)}</ul></>}
 {completed?<><h3>آموخته‌های تأییدشده</h3><ul>{preview.completion?.learnings.map((s,i)=><li key={i}>{s}</li>)}</ul></>:<><label className="field">آموخته‌های خودت؛ هر نکته در یک خط (اختیاری)<textarea rows={4} value={learnings} disabled={busy} onChange={e=>setLearnings(e.target.value)}/></label>
 {summary.hasFutureDays&&<label className="field"><span><input type="checkbox" checked={early} disabled={busy} onChange={e=>setEarly(e.target.checked)}/> پایان زودهنگام با وجود روزهای آینده را تأیید می‌کنم.</span></label>}
 <label className="field"><span><input type="checkbox" checked={confirm} disabled={busy} onChange={e=>setConfirm(e.target.checked)}/> ناقص بودن احتمالی نتایج را می‌پذیرم؛ پایان کمپین و توقف ویرایش را تأیید می‌کنم.</span></label>
 <button className="primary" disabled={busy||!confirm||(summary.hasFutureDays&&!early)} onClick={()=>void finish()}>پایان کمپین و ذخیره آموخته‌ها</button></>}
 </>}
 </section>;
}

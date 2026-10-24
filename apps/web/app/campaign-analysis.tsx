'use client';
import DisclosureSummary from './disclosure-summary';
import { useEffect, useState } from 'react';
import { request } from './api';
type Task={id?:string;title:string;why?:string|null;cta?:string|null;type?:string};
type Change={operation:'EDIT'|'ADD'|'REMOVE'|'MOVE';targetDayNumber:number;targetTaskId:string|null;task:Task|null;reason:string};
type Legacy={schemaVersion?:undefined;summary:string;observations:string[];recommendations:string[];limitations:string[];changes:{dayId:string;reason:string;mission:string;objective:string;tasks:Task[]}[]};
type Modern={schemaVersion:2;summary:string;facts:{text:string}[];calculations:{label:string;value:string;basis:string}[];signals:{text:string;evidence:string}[];hypotheses:{text:string;confidence:string}[];recommendation:{type:string;summary:string;reason:string;proposedChanges:Change[]};missingInformation:string[];limitations:string[]};
type Day={id:string;dayNumber:number;mission:string;tasks:Task[]};
type Analysis={sourceHash:string;status:string;stale?:boolean;createdAt:string;report:Legacy|Modern;beforeDays?:Day[]};
export default function CampaignAnalysis({campaignId,days,hasResults,onApplied}:{campaignId:string;days:Day[];hasResults:boolean;onApplied:()=>Promise<void>}){
 const [analysis,setAnalysis]=useState<Analysis|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');request<Analysis|null>('campaigns/'+campaignId+'/analysis').then(a=>{if(active){setAnalysis(a);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[campaignId,days]);
 async function act(action:'analyze'|'apply'|'dismiss'){
  if(busy)return;setBusy(true);setError('');
  try{const result=await request<Analysis>('campaigns/'+campaignId+'/analysis'+(action==='analyze'?'':'/decision'),{method:'POST',body:action==='analyze'?undefined:JSON.stringify({action,sourceHash:analysis?.sourceHash})});setAnalysis(result);if(action==='apply')await onApplied();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const modern=analysis?.report.schemaVersion===2?analysis.report:null;
 const legacy=analysis&&analysis.report.schemaVersion!==2?analysis.report:null;
 const noChange=modern?.recommendation.type==='NO_CHANGE'||!!legacy&&!legacy.changes.length;
 return <section className="day-card" id="campaign-analysis"><h2>بررسی وضعیت کمپین</h2><p className="wizard-hint">بررسی با AI هزینه دارد؛ هیچ تغییری بدون تأیید تو اعمال نمی‌شود.</p>
 <button className="primary" disabled={busy||!hasResults} onClick={()=>void act('analyze')}>{busy?'در حال بررسی…':'بررسی و پیشنهاد برای ادامه کمپین'}</button>
 {!hasResults&&<p>ابتدا نتیجه حداقل یک روز را ثبت کن.</p>}{error&&<p className="error" role="alert">{error}</p>}
 {analysis&&<><h3>{analysis.status==='APPLIED'?(noChange?'برنامه بدون تغییر ادامه دارد':'اصلاحات اعمال شده'):analysis.status==='DISMISSED'?'پیشنهاد رد شده':'پیشنهاد آماده بررسی'}</h3><h4>مهم‌ترین نکته</h4><p>{analysis.report.summary}</p>
 {analysis.stale&&<p role="alert">این پیشنهاد با اطلاعات قبلی ساخته شده؛ برای اعمال، دوباره بررسی کن.</p>}
 {modern&&<><h3>وضعیت بر اساس داده‌های ثبت‌شده</h3><p>{modern.facts[0]?.text||'داده کافی برای نتیجه قطعی وجود ندارد.'}</p><h3>اقدام پیشنهادی</h3><p>{modern.recommendation.summary}</p><details><DisclosureSummary icon="chart">مشاهده شواهد، محاسبات و برداشت‌ها</DisclosureSummary><h4>واقعیت‌های ثبت‌شده</h4><ul>{modern.facts.map((f,i)=><li key={i}>{f.text}</li>)}</ul>
 {modern.calculations.length>0&&<details><DisclosureSummary icon="chart">محاسبه از عددهای ثبت‌شده</DisclosureSummary>{modern.calculations.map((c,i)=><p key={i}>{c.label}: {c.value}<br/><small>{c.basis}</small></p>)}</details>}
 <h3>چه سیگنال‌هایی می‌بینیم؟</h3>{modern.signals.map((s,i)=><article key={i}><p>{s.text}</p><small>شواهد: {s.evidence}</small></article>)}
 <h3>برداشت احتمالی؛ نه واقعیت قطعی</h3>{modern.hypotheses.map((h,i)=><p key={i}>{h.text} · اطمینان: {({LOW:'کم',MEDIUM:'متوسط',HIGH:'زیاد'} as Record<string,string>)[h.confidence]}</p>)}
 <p>دلیل پیشنهاد: {modern.recommendation.reason}</p></details>
 {modern.missingInformation.length>0&&<><h3>اطلاعاتی که هنوز لازم است</h3><ul>{modern.missingInformation.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
 {modern.recommendation.proposedChanges.length>0&&<p className="wizard-hint">پیش از اعمال، روزها و تغییرات زیر را بررسی کن. فقط همین موارد تغییر می‌کنند.</p>}{modern.recommendation.proposedChanges.map((ch,i)=>{const before=(analysis.beforeDays||days).flatMap(d=>d.tasks).find(t=>t.id===ch.targetTaskId);const source=(analysis.beforeDays||days).find(d=>d.tasks.some(t=>t.id===ch.targetTaskId));return <article className="day-card" key={i}><h3>پیشنهاد تغییر برنامه · روز {ch.targetDayNumber.toLocaleString('fa-IR')}</h3><p>عملیات: {{EDIT:'ویرایش یک کار',ADD:'افزودن یک کار',REMOVE:'بایگانی یک کار',MOVE:'انتقال یک کار'}[ch.operation]}</p><table className="compact-table"><thead><tr><th scope="col">پیش از تغییر</th><th scope="col">پس از تأیید</th></tr></thead><tbody><tr><td>{before?.title||'کار جدید'}</td><td>{ch.operation==='REMOVE'?'بایگانی؛ سابقه محفوظ است':ch.operation==='MOVE'?before?.title:ch.task?.title}</td></tr>{ch.task&&<tr><td>اقدام: {before?.cta||'—'}</td><td>اقدام: {ch.task.cta||'بدون دعوت به اقدام'}</td></tr>}</tbody></table>{ch.operation==='MOVE'&&<p>از روز {source?.dayNumber.toLocaleString('fa-IR')} به روز {ch.targetDayNumber.toLocaleString('fa-IR')}</p>}{ch.task&&<><details><DisclosureSummary icon="document">مشاهده دلیل کار</DisclosureSummary><p>{ch.task.why}</p></details></>}<p>دلیل تغییر: {ch.reason}</p></article>;})}</>}
 {legacy&&<><h3>مشاهدات گزارش قدیمی</h3><ul>{legacy.observations.map((s,i)=><li key={i}>{s}</li>)}</ul><h3>پیشنهادها</h3><ul>{legacy.recommendations.map((s,i)=><li key={i}>{s}</li>)}</ul>{legacy.changes.map(ch=><article className="day-card" key={ch.dayId}><p>مأموریت قبلی: {(analysis.beforeDays||days).find(d=>d.id===ch.dayId)?.mission}</p><p>مأموریت پیشنهادی: {ch.mission}</p><p>{ch.reason}</p>{ch.tasks.map((t,i)=><p key={i}>{t.title} — {t.why}</p>)}</article>)}</>}
 <details><DisclosureSummary icon="document">محدودیت‌های بررسی</DisclosureSummary><ul>{analysis.report.limitations.map((s,i)=><li key={i}>{s}</li>)}</ul></details>
 {noChange&&<p>ادامه برنامه فعلی پیشنهاد شده؛ هیچ کاری تغییر نمی‌کند.</p>}
 {analysis.status==='PENDING'&&<div className="wizard-actions"><button className="primary" disabled={busy||analysis.stale||!!legacy&&noChange} onClick={()=>void act('apply')}>{noChange?'ادامه طبق برنامه':'اعمال پیشنهاد'}</button><button className="outline" disabled={busy} onClick={()=>void act('dismiss')}>فعلاً تغییر نده</button></div>}
 </>}
 </section>;
}

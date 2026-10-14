'use client';
import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import PlanningDetailsForm from './planning-details-form';
import {buildDetailedInput,emptyDetails,type PlanningDetails} from './planning-details';

type Draft = { name:string; product:string; objective:string; audience:string; offer:string; platform:string; duration:number; action:string; destination:string; maxContentPerDay:number; creationKey:string; details:PlanningDetails; learningSource:string };
const initial:Draft={name:'',product:'',objective:'',audience:'',offer:'',platform:'',duration:7,action:'',destination:'',maxContentPerDay:1,creationKey:'',details:emptyDetails,learningSource:''};
const storageKey='campaign-manager-simple-draft-v2';
const fa=(n:number)=>n.toLocaleString('fa-IR');

export default function SimpleCampaignWizard<T>({onClose,onCreated,previousCampaigns=[]}:{onClose:()=>void;onCreated:(campaign:T)=>void;previousCampaigns?:{id:string;name:string;status:string;completion?:{learnings:string[]}|null}[]}) {
  const [step,setStep]=useState(0),[draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submitting=useRef(false);
  const dialog=useRef<HTMLElement>(null);
  useEffect(()=>{
    try {const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);setDraft({...initial,...saved,details:{...emptyDetails,...saved.details}});}} catch {/* Storage is optional. */}
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.querySelector<HTMLElement>('input')?.focus();
    return ()=>previous?.focus();
  },[]);
  function update<K extends keyof Draft>(key:K,value:Draft[K]) {
    setDraft(current=>{const next={...current,[key]:value};try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}return next;});setError('');
  }
  const needsDestination=['مراجعه به لینک خرید','تکمیل فرم','تماس تلفنی'].includes(draft.action);
  let validation='';
  try{buildDetailedInput({...draft.details,maxContentPerDay:draft.maxContentPerDay});}catch(e){validation=(e as Error).message;}
  if(step===0){if(draft.name.trim().length<2)validation='نام کمپین باید حداقل ۲ کاراکتر باشد.';else if(draft.product.trim().length<2)validation='محصول یا خدمت را توضیح بده.';else if(!draft.objective)validation='هدف اصلی را انتخاب کن.';}
  if(step===1){if(!draft.platform)validation='پلتفرم اصلی را انتخاب کن.';else if(!draft.action)validation='اقدام مخاطب را انتخاب کن.';else if(needsDestination&&!draft.destination.trim())validation='نشانی یا شماره تماس مقصد را وارد کن.';else if(['مراجعه به لینک خرید','تکمیل فرم'].includes(draft.action)&&!/^https?:\/\/\S+$/i.test(draft.destination.trim()))validation='نشانی را با https:// یا http:// وارد کن.';}
  async function next(){
    if(validation||submitting.current)return;
    if(step<2){setStep(step+1);return;}
    submitting.current=true;setBusy(true);setError('');
    const key=draft.creationKey||crypto.randomUUID();update('creationKey',key);
    try {
      const path={action:draft.action,details:[draft.destination.trim(),`بستر اجرا: ${draft.platform}`].filter(Boolean).join('؛ ')};
      const result=await request<T>('campaigns',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({name:draft.name.trim(),product:draft.product.trim(),businessType:'کسب‌وکار',campaignType:draft.objective,audience:draft.audience.trim()||undefined,offer:{kind:draft.offer.trim()?'پیشنهاد ویژه':'پیشنهاد خاصی ندارم',details:draft.offer.trim()},salesPath:path,conversionPath:path,duration:draft.duration,...buildDetailedInput({...draft.details,maxContentPerDay:draft.maxContentPerDay}),previousLearnings:previousCampaigns.find(c=>c.id===draft.learningSource&&c.status==='COMPLETED')?.completion?.learnings,creationKey:key})});
      try{localStorage.removeItem(storageKey);}catch{}onCreated(result);onClose();
    }catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}
  }
  return <div className="modal-backdrop"><section ref={dialog} className="wizard simple-wizard" role="dialog" aria-modal="true" aria-labelledby="simple-wizard-title" onKeyDown={e=>{
    if(e.key==='Escape'&&!busy)onClose();
    if(e.key==='Tab'){const elements=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select');if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}><button className="close" aria-label="بستن" disabled={busy} onClick={onClose}>×</button><span className="eyebrow">مرحله {fa(step+1)} از ۳</span><div className="wizard-progress" aria-hidden="true"><span style={{width:`${((step+1)/3)*100}%`}}/></div><h2 id="simple-wizard-title">{['معرفی کمپین','برنامه اجرا','بررسی و ساخت'][step]}</h2>
  <p className="wizard-hint">اطلاعات تا ثبت نهایی در همین مرورگر حفظ می‌شود.</p>
  <form onSubmit={e=>{e.preventDefault();void next();}}>
  {step===0&&<><label className="field">نام کمپین<input maxLength={200} value={draft.name} onChange={e=>update('name',e.target.value)}/></label><label className="field">چه محصول یا خدمتی را معرفی می‌کنی؟<textarea maxLength={5000} value={draft.product} onChange={e=>update('product',e.target.value)}/></label><label className="field">هدف اصلی<select value={draft.objective} onChange={e=>update('objective',e.target.value)}><option value="">انتخاب کن</option>{['افزایش فروش','جذب مشتری جدید','معرفی محصول جدید'].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">مخاطب اصلی چه کسانی هستند؟ (اختیاری)<textarea maxLength={5000} value={draft.audience} onChange={e=>update('audience',e.target.value)}/></label><label className="field">پیشنهاد ویژه (اختیاری)<input maxLength={2000} value={draft.offer} onChange={e=>update('offer',e.target.value)}/></label></>}
  {step===1&&<><label className="field">پلتفرم اصلی<select value={draft.platform} onChange={e=>update('platform',e.target.value)}><option value="">انتخاب کن</option>{['اینستاگرام','تلگرام','ایتا','بله'].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">مدت کمپین<select value={draft.duration} onChange={e=>update('duration',Number(e.target.value))}>{[3,5,7,14].map(v=><option key={v} value={v}>{fa(v)} روز</option>)}</select></label><label className="field">مخاطب برای اقدام چه کاری انجام دهد؟<select value={draft.action} onChange={e=>{update('action',e.target.value);update('destination','');}}><option value="">انتخاب کن</option>{['ارسال پیام','مراجعه به لینک خرید','تکمیل فرم','تماس تلفنی'].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">روزانه چند محتوا می‌توانی منتشر کنی؟<select value={draft.maxContentPerDay} onChange={e=>update('maxContentPerDay',Number(e.target.value))}>{[1,2,3].map(v=><option key={v} value={v}>{fa(v)} محتوا</option>)}</select><small>این سقف انتشار است؛ تعداد اجباری نیست.</small></label><label className="field">{needsDestination?'نشانی یا شماره تماس مقصد':'شناسه یا راه ارتباطی (اختیاری)'}<input dir="ltr" maxLength={1800} value={draft.destination} onChange={e=>update('destination',e.target.value)}/></label></>}
  {step===0&&<details><summary>دقیق‌تر بساز (اختیاری)</summary><label className="field">جزئیات برنامه<select value={draft.details.mode} onChange={e=>update('details',{...draft.details,mode:e.target.value as 'quick'|'detailed'})}><option value="quick">سریع بساز</option><option value="detailed">دقیق‌تر بساز</option></select></label>{draft.details.mode==='detailed'&&<PlanningDetailsForm value={draft.details} onChange={v=>update('details',v)}/>}</details>}
  {step===2&&previousCampaigns.some(c=>c.status==='COMPLETED'&&c.completion?.learnings.length)&&<label className="field">استفاده اختیاری از آموخته‌های کمپین قبلی<select value={draft.learningSource} onChange={e=>update('learningSource',e.target.value)}><option value="">بدون انتقال آموخته‌ها</option>{previousCampaigns.filter(c=>c.status==='COMPLETED'&&c.completion?.learnings.length).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
  {step===2&&<div className="review"><p><strong>{draft.name}</strong></p><p>محصول: {draft.product}</p><p>هدف: {draft.objective}</p><p>مخاطب: {draft.audience||'هنوز مشخص نیست'}</p><p>{draft.platform} · {fa(draft.duration)} روز · {draft.action}</p><p>سقف روزانه: {fa(draft.maxContentPerDay)} محتوا</p>{draft.destination&&<p>مقصد: <bdi>{draft.destination}</bdi></p>}{draft.offer&&<p>پیشنهاد: {draft.offer}</p>}<p className="wizard-hint">با ساخت کمپین، اطلاعات ذخیره می‌شود. ساخت برنامه هوش مصنوعی در مرحله بعد و با تأیید تو انجام می‌شود.</p></div>}
  {validation&&<p className="error" role="alert">{validation}</p>}{error&&<p className="error" role="alert">{error}</p>}<div className="wizard-actions"><button type="submit" className="primary" disabled={busy||!!validation}>{busy?'در حال ذخیره…':step===2?'ساخت کمپین':'ادامه'}</button>{step>0&&<button type="button" className="outline" disabled={busy} onClick={()=>{setStep(step-1);setError('');}}>بازگشت</button>}</div></form></section></div>;
}

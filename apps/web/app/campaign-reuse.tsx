'use client';
import { useEffect, useRef, useState } from 'react';
import { CopyPlus } from 'lucide-react';
import { request } from './api';
import type { Campaign } from './campaign-types';
import PersianDateInput from './persian-date-input';
import {isoToPersian,persianToIso} from './persian-date';

export default function CampaignReuse({campaign,onClose,onCreated}:{campaign:Campaign;onClose:()=>void;onCreated:(value:Campaign)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),submitting=useRef(false);
 const [name,setName]=useState((campaign.name+' — نسخه جدید').slice(0,200));
 const [startDate,setStartDate]=useState(()=>isoToPersian(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())));
 const [mode,setMode]=useState(campaign.aiPlan?'plan':'setup'),[includeLearnings,setIncludeLearnings]=useState(false);
 const [key]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
 async function submit(){if(submitting.current)return;const isoDate=persianToIso(startDate);if(!isoDate){setError('تاریخ شروع شمسی معتبر وارد کن.');return;}submitting.current=true;setBusy(true);setError('');try{
  const result=await request<Campaign>('campaigns/'+campaign.id+'/reuse',{method:'POST',body:JSON.stringify({name:name.trim(),startDate:isoDate,mode,includeLearnings,expectedUpdatedAt:campaign.updatedAt,key})});
  onCreated(result);
 }catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}}
 return <dialog ref={dialog} className="content-dialog reuse-dialog" aria-labelledby="reuse-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><button type="button" className="close" aria-label="بستن استفاده مجدد" disabled={busy} onClick={onClose}>×</button><div className="icon-box"><CopyPlus size={22}/></div><h2 id="reuse-title">استفاده مجدد از کمپین</h2><p className="wizard-hint">اطلاعات «{campaign.name}» را برای یک اجرای تازه استفاده کن.</p>
 <form onSubmit={e=>{e.preventDefault();void submit();}}><label className="field">نام کمپین جدید<input autoFocus required minLength={2} maxLength={200} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label><PersianDateInput value={startDate} onChange={setStartDate} disabled={busy}/><label className="field">روش استفاده مجدد<select value={mode} disabled={busy} onChange={e=>setMode(e.target.value)}><option value="plan" disabled={!campaign.aiPlan}>اطلاعات و طرح قبلی؛ اجرای دوباره</option><option value="setup">فقط اطلاعات؛ ساخت طرح تازه</option></select></label>
 <div className="reuse-description"><strong>{mode==='plan'?'طرح قبلی را بررسی و دوباره اجرا کن':'با اطلاعات قبلی یک طرح تازه بساز'}</strong><p>{mode==='plan'?'اطلاعات و طرح ذخیره‌شده در یک پیش‌نویس جدید کپی می‌شوند. پس از بررسی و تأیید تو، روزها بر اساس تاریخ جدید و کارها با وضعیت انجام‌نشده ساخته می‌شوند.':'اطلاعات محصول، مخاطب، پیشنهاد و زمینه برنامه‌ریزی کپی می‌شوند. در تب اطلاعات آن‌ها را ویرایش کن و سپس از تب برنامه، طرح تازه بساز.'}</p></div>
 {campaign.status==='COMPLETED'&&!!campaign.completion?.learnings?.length&&<label className="field"><span><input type="checkbox" checked={includeLearnings} disabled={busy} onChange={e=>setIncludeLearnings(e.target.checked)}/> آموخته‌های تأییدشده این کمپین هم منتقل شوند.</span></label>}
 <p className="wizard-hint">کمپین اصلی محفوظ می‌ماند. محتواهای تولیدشده، نتایج، سوابق، وضعیت انجام کارها و آماده‌سازی منتقل نمی‌شوند. در حالت طرح قبلی، برنامه ذخیره‌شده کپی می‌شود؛ تغییرات دستیِ اجرای قبلی منتقل نمی‌شوند. تاریخ‌های پیشنهاد و شواهد را پیش از تأیید دوباره بررسی کن.</p><p className="wizard-hint">کپی‌کردن درخواست AI ندارد. ساخت طرح تازه فقط با انتخاب جداگانه تو انجام می‌شود.</p>{error&&<p role="alert" className="error">{error}</p>}<div className="editor-actions"><button type="submit" className="primary" disabled={busy||name.trim().length<2||!persianToIso(startDate)}>{busy?'در حال ساخت نسخه جدید…':'ساخت پیش‌نویس جدید'}</button><button type="button" className="outline" disabled={busy} onClick={onClose}>انصراف</button></div></form></dialog>;
}

'use client';
import DisclosureSummary from './disclosure-summary';
import { useState } from 'react';
import { request } from './api';
export default function CampaignManagement({campaign,changed,removed}:{campaign:{id:string;name:string;status:string;updatedAt:string};changed:()=>Promise<void>;removed:(id:string)=>void}){
 const [preview,setPreview]=useState<{token:string;name:string;days:number;tasks:number;results:number}|null>(null),[name,setName]=useState(''),[confirmed,setConfirmed]=useState(false),[reset,setReset]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function action(kind:'preview'|'delete'|'replan'){if(busy)return;setBusy(true);setError('');try{
  if(kind==='preview'){setPreview(await request('campaigns/'+campaign.id+'/deletion'));setName('');setConfirmed(false);}
  else if(kind==='delete'){await request('campaigns/'+campaign.id+'/delete',{method:'POST',body:JSON.stringify({token:preview?.token,name,confirm:confirmed})});removed(campaign.id);}
  else{await request('campaigns/'+campaign.id+'/replan',{method:'POST',body:JSON.stringify({expectedUpdatedAt:campaign.updatedAt,confirm:reset})});setReset(false);await changed();}
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="day-card"><DisclosureSummary icon="settings">حذف کمپین یا ساخت طرح از نو</DisclosureSummary>
 {campaign.status==='DRAFT'?<><p>برای ویرایش، بخش «ویرایش اطلاعات پایه و پیشنهاد» را باز کن. برای طرح تازه بدون تغییر اطلاعات، طرح فعلی را کنار بگذار؛ سپس دکمه «ساخت طرح کمپین» را بزن. فقط ساخت طرح هزینه AI دارد.</p><label className="field"><span><input type="checkbox" checked={reset} disabled={busy} onChange={e=>setReset(e.target.checked)}/> کنارگذاشتن طرح پیش‌نویس و ساخت دوباره را تأیید می‌کنم.</span></label><button className="outline" disabled={busy||!reset} onClick={()=>void action('replan')}>کنارگذاشتن طرح و شروع دوباره</button></>:<p>برای ویرایش و طرح تازه، بخش «ویرایش و ساخت نسخه تازه» را باز کن. نسخه قبلی و نتایجش حفظ می‌شوند.</p>}
 <p>حذف دائمی است و برنامه، محتوا، نتایج، آماده‌سازی و سوابق همین کمپین را حذف می‌کند. قبل از حذف می‌توانی گزارش JSON را دانلود کنی.</p><button className="outline" disabled={busy} onClick={()=>void action('preview')}>بررسی حذف کمپین</button>
 {preview&&<section><p>کمپین «{preview.name}»: {preview.days.toLocaleString('fa-IR')} روز، {preview.tasks.toLocaleString('fa-IR')} کار و {preview.results.toLocaleString('fa-IR')} نتیجه حذف می‌شود.</p><label className="field">برای تأیید حذف، نام کمپین را دقیقاً بنویس<input value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label><label className="field"><span><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> می‌دانم حذف دائمی است و از داخل برنامه قابل بازگرداندن نیست.</span></label><button className="outline" disabled={busy||!confirmed||name!==preview.name} onClick={()=>void action('delete')}>حذف دائمی همین کمپین</button><button className="outline" disabled={busy} onClick={()=>setPreview(null)}>انصراف از حذف</button></section>}
 {error&&<p role="alert" className="error">{error}</p>}</details>;
}

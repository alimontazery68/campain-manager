'use client';
import DisclosureSummary from './disclosure-summary';
import { useRef, useState } from 'react';
import { request } from './api';
import CampaignDeleteDialog, {type DeletionPreview} from './campaign-delete-dialog';
export default function CampaignManagement({campaign,changed,removed}:{campaign:{id:string;name:string;status:string;updatedAt:string};changed:()=>Promise<void>;removed:(id:string)=>void}){
 const deleteTrigger=useRef<HTMLButtonElement>(null);
 const [preview,setPreview]=useState<DeletionPreview|null>(null),[name,setName]=useState(''),[confirmed,setConfirmed]=useState(false),[reset,setReset]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function action(kind:'preview'|'delete'|'replan'){if(busy)return;setBusy(true);setError('');try{
  if(kind==='preview'){setPreview(await request('campaigns/'+campaign.id+'/deletion'));setName('');setConfirmed(false);}
  else if(kind==='delete'){await request('campaigns/'+campaign.id+'/delete',{method:'POST',body:JSON.stringify({token:preview?.token,name,confirm:confirmed})});removed(campaign.id);}
  else{await request('campaigns/'+campaign.id+'/replan',{method:'POST',body:JSON.stringify({expectedUpdatedAt:campaign.updatedAt,confirm:reset})});setReset(false);await changed();}
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="day-card"><DisclosureSummary icon="settings">حذف کمپین یا ساخت طرح از نو</DisclosureSummary>
 {campaign.status==='DRAFT'?<><p>برای ویرایش، بخش «ویرایش اطلاعات پایه و پیشنهاد» را باز کن. برای طرح تازه بدون تغییر اطلاعات، طرح فعلی را کنار بگذار؛ سپس دکمه «ساخت طرح کمپین» را بزن. فقط ساخت طرح هزینه AI دارد.</p><label className="field"><span><input type="checkbox" checked={reset} disabled={busy} onChange={e=>setReset(e.target.checked)}/> کنارگذاشتن طرح پیش‌نویس و ساخت دوباره را تأیید می‌کنم.</span></label><button className="outline" disabled={busy||!reset} onClick={()=>void action('replan')}>کنارگذاشتن طرح و شروع دوباره</button></>:<p>برای ویرایش و طرح تازه، بخش «ویرایش و ساخت نسخه تازه» را باز کن. نسخه قبلی و نتایجش حفظ می‌شوند.</p>}
 <p>حذف دائمی است و برنامه، محتوا، نتایج، آماده‌سازی و سوابق همین کمپین را حذف می‌کند. قبل از حذف می‌توانی گزارش اکسل را دانلود کنی.</p><button ref={deleteTrigger} className="outline" disabled={busy} onClick={()=>void action('preview')}>بررسی حذف کمپین</button>
 {preview&&<CampaignDeleteDialog preview={preview} returnFocusTo={deleteTrigger.current} name={name} confirmed={confirmed} busy={busy} error={error} onName={setName} onConfirm={setConfirmed} onDelete={()=>void action('delete')} onClose={()=>{setPreview(null);setError('');}}/>}
 {error&&!preview&&<p role="alert" className="error">{error}</p>}</details>;
}

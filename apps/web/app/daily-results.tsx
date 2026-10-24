'use client';
import DisclosureSummary from './disclosure-summary';
import { useEffect, useState } from 'react';
import { request } from './api';
export type DailyResult={id:string;rating:string;views:number|null;leads:number|null;warmLeads?:number|null;notes?:string|null;sales:number|null;revenue:string|null;feedback:string|null;updatedAt:string};
function numberValue(value:string):number|null {
  const normalized=value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[,٬\s]/g,'');
  if(!normalized)return null;
  if(!/^\d+$/.test(normalized))throw new Error('عددها را نامنفی و بدون اعشار وارد کن.');
  const n=Number(normalized);if(!Number.isSafeInteger(n))throw new Error('عدد واردشده خیلی بزرگ است.');return n;
}
export default function DailyResults({dayId,result,future,onSaved}:{dayId:string;result?:DailyResult|null;future:boolean;onSaved:(value:DailyResult)=>void}) {
  const [rating,setRating]=useState(result?.rating||'');
  const [values,setValues]=useState({views:result?.views?.toString()||'',leads:result?.leads?.toString()||'',warmLeads:result?.warmLeads?.toString()||'',sales:result?.sales?.toString()||'',revenue:result?.revenue||''});
  const [notes,setNotes]=useState(result?.notes||'');
  const [feedback,setFeedback]=useState(result?.feedback||'');
  const [version,setVersion]=useState(result?.updatedAt??null);
  const [editing,setEditing]=useState(!result);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const key='campaign-day-result-'+dayId;
  useEffect(()=>{try {const raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw);if(d.version===version){setRating(d.rating);setValues(v=>({...v,...d.values}));setFeedback(d.feedback);setNotes(d.notes||'');}}}catch{}},[key,version]);
  function draft(nextRating=rating,nextValues=values,nextFeedback=feedback,nextNotes=notes){try{localStorage.setItem(key,JSON.stringify({rating:nextRating,values:nextValues,feedback:nextFeedback,notes:nextNotes,version}));}catch{}}
  async function save() {
    if(busy||future)return;setBusy(true);setError('');setNotice('');
    try {
      const data={rating,views:numberValue(values.views),leads:numberValue(values.leads),warmLeads:numberValue(values.warmLeads||''),sales:numberValue(values.sales),revenue:numberValue(values.revenue),feedback,notes,expectedUpdatedAt:version};
      const saved=await request<DailyResult>('campaigns/days/'+dayId+'/result',{method:'POST',body:JSON.stringify(data)});
      try{localStorage.removeItem(key);}catch{}setVersion(saved.updatedAt);onSaved(saved);setEditing(false);setNotice('نتیجه ذخیره شد. می‌توانی بعداً اصلاحش کنی.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(future)return <p className="wizard-hint">نتیجه این روز را پس از رسیدن تاریخ آن ثبت کن.</p>;
  return <section className="day-card"><h2>این روز کمپین چطور بود؟</h2><p className="wizard-hint">فقط چیزهایی را که می‌دانی ثبت کن. فیلد خالی یعنی نامعلوم؛ صفر یعنی نتیجه واقعاً صفر بوده است.</p>
    {!editing&&result?<><h3>نتیجه ذخیره‌شده</h3><p>وضعیت: {({WEAK:'ضعیف',NORMAL:'معمولی',GOOD:'خوب',GREAT:'خیلی خوب'} as Record<string,string>)[result.rating]}</p>{([['views','بازدید'],['leads','سرنخ (مشتری بالقوه)'],['warmLeads','افراد علاقه‌مند'],['sales','فروش'],['revenue','درآمد (تومان)']] as const).map(([field,label])=>result[field]!=null?<p key={field}>{label}: {Number(result[field]).toLocaleString('fa-IR')}</p>:null)}{result.feedback&&<p>بازخورد: {result.feedback}</p>}{result.notes&&<p>یادداشت: {result.notes}</p>}<button className="outline" onClick={()=>setEditing(true)}>ویرایش نتیجه</button><button className="outline" onClick={()=>document.getElementById('campaign-analysis')?.scrollIntoView({behavior:'smooth'})}>رفتن به بررسی و پیشنهاد؛ بدون درخواست خودکار AI</button><p role="status">{notice}</p></>:<>
    <div className="editor-actions">{[['WEAK','ضعیف'],['NORMAL','معمولی'],['GOOD','خوب'],['GREAT','خیلی خوب']].map(([value,label])=><button disabled={busy} aria-pressed={rating===value} className={rating===value?'primary':'outline'} key={value} onClick={()=>{setRating(value);draft(value);}}>{label}</button>)}</div>
    <div className="result-metrics">{([['views','بازدید'],['leads','سرنخ (مشتری بالقوه)'],['sales','فروش / ثبت‌نام']] as const).map(([name,label])=><label className="field" key={name}>{label}<input inputMode="numeric" value={values[name]} disabled={busy} onChange={e=>{const next={...values,[name]:e.target.value};setValues(next);draft(rating,next);}}/></label>)}</div>
    <details><DisclosureSummary icon="chart">عددهای تکمیلی روز (اختیاری)</DisclosureSummary><div className="result-metrics">{([['warmLeads','افراد علاقه‌مندِ هنوز خریدنکرده'],['revenue','درآمد (تومان)']] as const).map(([name,label])=><label className="field" key={name}>{label}<input inputMode="numeric" value={values[name]} disabled={busy} onChange={e=>{const next={...values,[name]:e.target.value};setValues(next);draft(rating,next);}}/></label>)}</div></details>

    <details><DisclosureSummary icon="document">بازخورد و اطلاعات تکمیلی روز</DisclosureSummary>    <label className="field">نکته دیگری دیدی؟ (اختیاری)<textarea aria-label="نکته دیگری دیدی؟ (اختیاری)" rows={2} maxLength={5000} disabled={busy} value={notes} onChange={e=>{setNotes(e.target.value);draft(rating,values,feedback,e.target.value);}}/></label>
    <label className="field">مهم‌ترین سؤال یا اعتراض مخاطب چه بود؟<textarea aria-label="مهم‌ترین سؤال یا اعتراض مخاطب چه بود؟" rows={3} maxLength={5000} value={feedback} disabled={busy} onChange={e=>{setFeedback(e.target.value);draft(rating,values,e.target.value);}}/></label>
</details>
    {error&&<p className="error" role="alert">{error}</p>}<p role="status">{notice}</p><button className="primary" disabled={busy||!rating} onClick={()=>void save()}>{busy?'در حال ذخیره…':version?'ذخیره اصلاحات':'ثبت نتیجه روز'}</button>
    </>}
    <p className="wizard-hint">ثبت نتیجه درخواست هوش مصنوعی ارسال نمی‌کند.</p>
  </section>;
}

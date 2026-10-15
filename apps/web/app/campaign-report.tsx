'use client';
import DisclosureSummary from './disclosure-summary';
import { useState } from 'react';
import { request } from './api';
export default function CampaignReport({id,name}:{id:string;name:string}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function download(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const [campaign,summary,history,{createReportWorkbook}]=await Promise.all([
    request<Record<string,unknown>>('campaigns/'+id),
    request<Record<string,unknown>>('campaigns/'+id+'/completion'),
    request('campaigns/'+id+'/history'),import('./report-workbook'),
   ]);
   const data=await createReportWorkbook(campaign,summary,history);
   const url=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const a=document.createElement('a');a.href=url;a.download='campaign-'+id+'.xlsx';document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details className="day-card"><DisclosureSummary icon="download">گزارش و نسخه قابل دانلود</DisclosureSummary><p>گزارش اکسل {name} شامل برنامه، نتایج، محتوا، آموخته‌ها و تاریخچه در برگه‌های جداگانه است. این فایل ممکن است اطلاعات خصوصی کسب‌وکارت را داشته باشد؛ با دقت نگهداری کن.</p><button className="outline" disabled={busy} onClick={()=>void download()}>{busy?'در حال آماده‌سازی اکسل…':'دانلود گزارش اکسل'}</button>{error&&<p role="alert" className="error">{error}</p>}</details>;
}

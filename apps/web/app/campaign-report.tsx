'use client';
import { useState } from 'react';
import { request } from './api';
export default function CampaignReport({id,name}:{id:string;name:string}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function download(){setBusy(true);setError('');try{const campaign=await request<Record<string,unknown>>('campaigns/'+id),summary=await request('campaigns/'+id+'/completion'),history=await request('campaigns/'+id+'/history');const data=JSON.stringify({exportedAt:new Date().toISOString(),campaign,summary,history},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='campaign-'+id+'.json';a.click();URL.revokeObjectURL(url);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="day-card"><summary>گزارش و نسخه قابل دانلود</summary><p>گزارش {name} شامل برنامه، نتایج، محتوا، آموخته‌ها و تاریخچه است. این فایل ممکن است اطلاعات خصوصی کسب‌وکارت را داشته باشد؛ با دقت نگهداری کن.</p><button className="outline" disabled={busy} onClick={()=>void download()}>دانلود گزارش JSON؛ بدون AI</button>{error&&<p role="alert" className="error">{error}</p>}</details>;
}

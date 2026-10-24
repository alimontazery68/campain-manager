'use client';
import {ArrowLeft,Compass} from 'lucide-react';
import type {Campaign,Day} from './campaign-types';
import {campaignNext} from './execution-next';
export default function DashboardNext({campaigns,open}:{campaigns:Campaign[];open:(c:Campaign,d?:Day)=>void}){
 const c=campaigns.find(c=>c.status==='ACTIVE')||campaigns.find(c=>c.status==='DRAFT')||campaigns[0];
 if(!c)return null;
 const next=campaignNext(c);
 return <article className="next-step-hero" aria-labelledby="next-step-title"><div className="hero-symbol"><Compass size={30}/></div><div><span className="eyebrow">قدم بعدی تو</span><h2 id="next-step-title">{next.title}</h2><p>{c.name}{next.day?' · روز '+next.day.dayNumber.toLocaleString('fa-IR'):''}</p>{next.day&&<p className="hero-mission">{next.day.mission}</p>}<button className="primary" onClick={()=>open(c,next.day)}>{next.title}<ArrowLeft size={17}/></button></div></article>;
}
export function ActiveCampaigns({campaigns,open}:{campaigns:Campaign[];open:(c:Campaign,d?:Day)=>void}){
 const active=campaigns.filter(c=>c.status==='ACTIVE');
 return <section className="active-campaigns"><h2>کمپین‌های فعال</h2>{active.length?<div className="active-campaign-grid">{active.map(c=>{const next=campaignNext(c),tasks=c.days.flatMap(d=>d.tasks).filter(t=>!t.archived),done=tasks.filter(t=>t.status==='DONE').length;return <article key={c.id}><div className="section-title"><h3>{c.name}</h3><span className="tag purple">در حال اجرا</span></div><p>پیشرفت اجرا: {done.toLocaleString('fa-IR')} از {tasks.length.toLocaleString('fa-IR')} کار</p><progress value={done} max={tasks.length||1} aria-label={'پیشرفت اجرای '+c.name}/><button className="text-button" onClick={()=>open(c,next.day)}>{next.title}<ArrowLeft size={15}/></button></article>;})}</div>:<p className="wizard-hint">هنوز کمپینی در حال اجرا نیست؛ پیش‌نویس‌ها در فهرست کمپین‌ها در دسترس‌اند.</p>}</section>;
}

'use client';
import {useState} from 'react';
import {Check,ChevronRight} from 'lucide-react';
import type {Campaign} from './campaign-types';
export type CampaignStage='info'|'method'|'plan'|'preparation'|'execution'|'results'|'completion';
export const campaignStages:{id:CampaignStage;title:string;hint:string}[]=[
 {id:'info',title:'اطلاعات کسب‌وکار',hint:'اطلاعات واقعی محصول، هدف و امکانات را مرور یا اصلاح کن.'},
 {id:'method',title:'پیشنهاد روش',hint:'روش اصلی را بررسی کن؛ پذیرش روش، اجرای کمپین را آغاز نمی‌کند.'},
 {id:'plan',title:'بررسی طرح',hint:'خلاصه طرح را بخوان؛ جزئیات و ویرایش پیش از تأیید در دسترس‌اند.'},
 {id:'preparation',title:'آماده‌سازی',hint:'پیش‌نیازهای اجرا را آماده و وضعیتشان را ثبت کن.'},
 {id:'execution',title:'اجرای روزانه',hint:'روز و کار را انتخاب کن؛ محتوای آماده را خودت منتشر کن.'},
 {id:'results',title:'نتایج و اصلاحات',hint:'نتیجه واقعی را ثبت کن؛ اصلاح پیشنهادی فقط با تأیید تو اعمال می‌شود.'},
 {id:'completion',title:'جمع‌بندی',hint:'نتیجه‌ها و آموخته‌ها را مرور کن؛ پایان کمپین به تأیید جداگانه نیاز دارد.'}
];
export function defaultCampaignStage(c:Campaign):CampaignStage{return c.status==='COMPLETED'?'completion':c.status!=='DRAFT'?'execution':c.planningContext?.methodRequired&&!c.aiPlan&&!(c.methodReady??c.planningContext?.methodState?.accepted)?'method':'plan';}
export function stageUnavailable(c:Campaign,id:CampaignStage){
 if(id==='method'&&!c.planningContext?.methodRequired&&!c.planningContext?.methodState)return 'برای این کمپین قدیمی روش جداگانه‌ای ثبت نشده؛ طرح موجود را بررسی کن.';
 if(id==='plan'&&c.status==='DRAFT'&&c.planningContext?.methodRequired&&!c.aiPlan&&!(c.methodReady??c.planningContext?.methodState?.accepted))return 'ابتدا پیشنهاد روش را بررسی و بپذیر.';
 if(['preparation','execution','results','completion'].includes(id)&&c.status==='DRAFT')return 'ابتدا طرح را بررسی و تأیید کن تا برنامه اجرا ساخته شود.';
 return '';
}
export default function CampaignJourney({campaign,stage,select}:{campaign:Campaign;stage:CampaignStage;select:(s:CampaignStage)=>void}){
 const [notice,setNotice]=useState(''),visible=campaignStages.filter(s=>s.id!=='results'),index=visible.findIndex(s=>s.id===(stage==='results'?'execution':stage)),current=campaignStages.find(s=>s.id===stage)!;
 const done=(id:CampaignStage)=>id==='info'||id==='method'&&!!campaign.planningContext?.methodState?.accepted||id==='plan'&&campaign.status!=='DRAFT'||id==='preparation'&&(campaign.preparationTasks?.length>0?campaign.preparationTasks.every(t=>t.completed):campaign.status==='COMPLETED')||['execution','results','completion'].includes(id)&&campaign.status==='COMPLETED';
 return <section className="campaign-journey" aria-label="مسیر کمپین"><ol>{visible.map((item,i)=><li key={item.id}><button type="button" aria-label={item.title} aria-current={(stage===item.id||stage==='results'&&item.id==='execution')?'step':undefined} aria-disabled={!!stageUnavailable(campaign,item.id)} onClick={()=>{const reason=stageUnavailable(campaign,item.id);setNotice(reason);if(!reason)select(item.id);}}><span>{done(item.id)?<Check size={15} aria-label="تکمیل‌شده"/>:(i+1).toLocaleString('fa-IR')}</span>{item.title}</button></li>)}</ol>{campaign.status!=='DRAFT'&&<button className="text-button journey-results" type="button" onClick={()=>select('results')}>نتایج و اصلاحات</button>}<div className="journey-context"><div><span className="eyebrow">مرحله {(index+1).toLocaleString('fa-IR')} از ۶</span><strong className="journey-current-title">{current.title}</strong><details className="journey-help"><summary>راهنمای این مرحله</summary><p>{current.hint}</p></details></div>{index>0&&<button className="outline" onClick={()=>{let previous=index-1;while(previous>0&&stageUnavailable(campaign,visible[previous].id))previous--;select(visible[previous].id);setNotice('');}}><ChevronRight size={16}/>مرحله قبل</button>}</div>{notice&&<p role="status" className="wizard-hint">{notice}</p>}</section>;
}

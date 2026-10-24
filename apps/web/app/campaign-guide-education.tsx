'use client';
import {useEffect,useState} from 'react';
import {BookOpen,ArrowLeft,ArrowRight} from 'lucide-react';
import {request} from './api';
type Guide={id:string;version:string;title:string;summary:string;suitableWhen:string[];notSuitableWhen:string[];requirements:string[];stages:{title:string;description:string}[];example:{kind:'hypothetical';text:string};commonMistakes:string[];startChecklist:string[];measurement:string[];durationRule:string;learningNote:string};
type Bundle={guideVersion:string;evidenceScope:string;guides:Guide[]};
let cached:Promise<Bundle>|null=null;
function load(){if(!cached)cached=request<Bundle>('guides').then(data=>{if(!data||!Array.isArray(data.guides)||!data.guides.length)throw new Error('راهنما قابل خواندن نیست؛ دوباره تلاش کن.');return data;}).catch(e=>{cached=null;throw e;});return cached;}
const items=(values:string[])=><ul>{values.map((v,i)=><li key={i}>{v}</li>)}</ul>;
export function GuideBrowser({ids,stageIndex}:{ids?:string[];stageIndex?:number}){
 const [bundle,setBundle]=useState<Bundle|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState(''),[stages,setStages]=useState<Record<string,number>>({}),[compare,setCompare]=useState<string[]>([]);
 useEffect(()=>{let active=true;setError('');load().then(v=>{if(active)setBundle(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[retry]);
 if(error)return <div role="alert"><p>{error}</p><button type="button" className="outline" onClick={()=>setRetry(r=>r+1)}>خواندن دوباره راهنما</button></div>;
 if(!bundle)return <p role="status">در حال خواندن راهنماها…</p>;
 const guides=ids?bundle.guides.filter(g=>ids.includes(g.id)):bundle.guides;
 const guide=guides.find(g=>g.id===selected)||guides[0];
 if(!guide)return <p>برای این کمپین قدیمی راهنمای روش مشخصی ثبت نشده است.</p>;
 const index=Math.max(0,Math.min(stages[guide.id]??stageIndex??0,guide.stages.length-1)),stage=guide.stages[index];
 return <section className="guide-education" aria-label="آشنایی با روش‌های کمپین"><div className="section-title"><h2><BookOpen size={20}/>آشنایی با روش‌های کمپین</h2><span className="tag purple">نسخه {bundle.guideVersion}</span></div><p className="wizard-hint">مطالعه اختیاری است؛ خواندن و مقایسه راهنماها درخواست AI ندارد.</p>
 <div className="education-cards">{guides.map(g=><article key={g.id}><button className="education-select" type="button" aria-pressed={guide.id===g.id} onClick={()=>setSelected(g.id)}><BookOpen size={18}/><strong>{g.title}</strong><span>{g.summary}</span></button>{!ids&&<label className="education-compare"><input type="checkbox" checked={compare.includes(g.id)} disabled={!compare.includes(g.id)&&compare.length===2} onChange={e=>setCompare(v=>e.target.checked?[...v,g.id]:v.filter(id=>id!==g.id))}/>مقایسه {g.title}</label>}</article>)}</div>
 {compare.length>0&&<section className="education-comparison" aria-label="مقایسه روش‌ها"><h3>مقایسه دو روش</h3>{compare.length===1?<p>روش دوم را از کارت‌ها انتخاب کن.</p>:<table className="compact-table"><thead><tr>{compare.map(id=><th key={id} scope="col">{bundle.guides.find(g=>g.id===id)!.title}</th>)}</tr></thead><tbody>{(['summary','requirements','durationRule'] as const).map(field=><tr key={field}>{compare.map(id=>{const g=bundle.guides.find(g=>g.id===id)!;return <td key={id}>{Array.isArray(g[field])?items(g[field] as string[]):g[field]}</td>;})}</tr>)}</tbody></table>}</section>}
 <section className="education-detail" aria-label={'راهنمای '+guide.title}><h3>{guide.title}</h3><p>{guide.summary}</p><p className="education-note">{guide.learningNote}</p><details><summary>تناسب و نیازهای اجرا</summary><h4>مناسب برای</h4>{items(guide.suitableWhen)}<h4>نامناسب برای</h4>{items(guide.notSuitableWhen)}<h4>نیازها</h4>{items(guide.requirements)}<p>{guide.durationRule}</p></details>
 <div className="education-stage"><span className="eyebrow">گام {(index+1).toLocaleString('fa-IR')} از {guide.stages.length.toLocaleString('fa-IR')}</span><h4 aria-live="polite">{stage.title}</h4><p>{stage.description}</p><div className="editor-actions"><button className="outline" type="button" disabled={index===0} onClick={()=>setStages(v=>({...v,[guide.id]:index-1}))}><ArrowRight size={15}/>گام قبل</button><button className="outline" type="button" disabled={index===guide.stages.length-1} onClick={()=>setStages(v=>({...v,[guide.id]:index+1}))}>گام بعد<ArrowLeft size={15}/></button></div></div>
 <details><summary>مثال فرضی و خطاهای رایج</summary><span className="tag purple">مثال فرضی</span><p>{guide.example.text}</p><h4>خطاهای رایج</h4>{items(guide.commonMistakes)}</details><details><summary>چک‌لیست شروع و سنجه‌ها</summary><h4>پیش از شروع</h4>{items(guide.startChecklist)}<h4>سنجه‌ها</h4>{items(guide.measurement)}</details></section><details><summary>درباره این راهنماها</summary><p>{bundle.evidenceScope}</p></details></section>;
}
export default function GuideEducation({ids,stageIndex}:{ids?:string[];stageIndex?:number}){
 const [open,setOpen]=useState(false);
 return <details className="guide-education-disclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary><BookOpen size={17}/>راهنمای آموزشی روش؛ مطالعه اختیاری</summary>{open&&<GuideBrowser ids={ids} stageIndex={stageIndex}/>}</details>;
}

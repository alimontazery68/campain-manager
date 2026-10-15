'use client';
import RichContentEditor, { contentHtml } from './rich-content-editor';
import DisclosureSummary from './disclosure-summary';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultContentOptions, type ContentOptions } from './content-options';
type ContentTask = {id:string;title:string;format?:string|null;content?:string|null;cta?:string;why?:string};
export default function ContentEditor({task,onClose,onSaved,inline=false,settingsTarget,onComplete,completing=false}:{inline?:boolean;settingsTarget?:HTMLElement|null;onComplete?:()=>void;completing?:boolean;task:ContentTask;onClose:()=>void;onSaved:(id:string,content:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const key='campaign-content-draft-'+task.id;
  const [text,setText]=useState(task.content || '');
  const [saved,setSaved]=useState<string|null>(task.content ?? null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [previous,setPrevious]=useState<string|null>(null);
  const [options,setOptions]=useState<ContentOptions>(defaultContentOptions);
  const optionsKey='campaign-content-options-'+task.id;
  useEffect(()=>{try{const raw=localStorage.getItem(optionsKey);if(raw){const value=JSON.parse(raw);setOptions({tone:['campaign','friendly','formal','energetic'].includes(value.tone)?value.tone:'campaign',format:['task','text','voice','video','image','demo'].includes(value.format)?value.format:'task',instructions:typeof value.instructions==='string'?value.instructions.slice(0,1500):''});}}catch{}},[optionsKey]);
  function updateOptions(next:ContentOptions){setOptions(next);try{localStorage.setItem(optionsKey,JSON.stringify(next));}catch{}}
  useEffect(()=>{
    if(!inline)dialog.current?.showModal();
    try {const draft=localStorage.getItem(key);if(draft!==null)setText(draft);} catch {}
  },[key,inline]);
  const dirty=text!==(saved||'');
  async function perform(action:string) {
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      const manual=action==='save';
      let version=saved;
      // An explicit rewrite click first preserves any manual edits, without an AI call.
      if(!manual&&dirty) {
        const saveResponse=await fetch('/api/campaigns/tasks/'+task.id+'/content',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,expectedContent:version})});
        const saveResult=await saveResponse.json().catch(()=>null);
        if(!saveResponse.ok)throw new Error(saveResult?.message||'ویرایش ذخیره نشد؛ بازنویسی انجام نشد.');
        version=saveResult.content;setSaved(version);onSaved(task.id,saveResult.content);
      }
      const response=await fetch('/api/campaigns/tasks/'+task.id+'/content',{
        method:manual?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(manual?{content:text,expectedContent:saved}:{action,preferences:options})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:'ذخیره انجام نشد. متن تو حفظ شده است.');
      if(!manual&&version)setPrevious(version);
      setText(result.content);setSaved(result.content);onSaved(task.id,result.content);
      localStorage.removeItem(key);setNotice(manual?'متن ذخیره شد.':'محتوا ساخته و ذخیره شد؛ قبل از انتشار بررسی کن.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function copy() {
    try {const html=contentHtml(text);const node=document.createElement('div');node.innerHTML=html;document.body.appendChild(node);const plain=node.innerText;node.remove();if(typeof ClipboardItem!=='undefined'&&navigator.clipboard.write){try{await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([plain],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);}catch{await navigator.clipboard.writeText(plain);}}else await navigator.clipboard.writeText(plain);setNotice('متن کپی شد.');}
    catch {setError('کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کن.');}
  }
  function edit(value:string){setText(value);try{localStorage.setItem(key,value);}catch{}}
  const settings=<fieldset className="content-generation-settings" disabled={busy}>
    <legend>تنظیمات محتوا</legend>
    <div className="content-choice" role="group" aria-label="لحن محتوا"><span>لحن محتوا</span><div>{([['friendly','صمیمی'],['formal','رسمی'],['energetic','هیجانی']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={options.tone===value} onClick={()=>updateOptions({...options,tone:value})}>{label}</button>)}</div></div>
    <div className="content-choice" role="group" aria-label="نوع محتوا"><span>نوع محتوا</span><div>{([['text','متن'],['image','تصویر'],['video','ویدیو']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={options.format===value} onClick={()=>updateOptions({...options,format:value})}>{label}</button>)}</div></div>
    <details><DisclosureSummary icon="sparkles">راهنمای تکمیلی (اختیاری)</DisclosureSummary>
      <label className="field">لحن محتوا<select value={options.tone} onChange={e=>updateOptions({...options,tone:e.target.value as ContentOptions['tone']})}><option value="campaign">مطابق کمپین</option><option value="friendly">صمیمی</option><option value="formal">رسمی</option><option value="energetic">هیجانی</option></select></label>
      <label className="field">قالب خروجی<select value={options.format} onChange={e=>updateOptions({...options,format:e.target.value as ContentOptions['format']})}><option value="task">مطابق کار{task.format?'؛ '+task.format:''}</option><option value="text">متن پست</option><option value="voice">متن ویس</option><option value="video">سناریوی ویدیو</option><option value="image">متن تصویر و کپشن</option><option value="demo">سناریوی نمایش محصول</option></select></label>
      <label className="field">چه نکته‌ای در متن پررنگ‌تر شود؟<textarea rows={3} maxLength={1500} value={options.instructions} onChange={e=>updateOptions({...options,instructions:e.target.value})}/></label>
      <p className="wizard-hint">گزینه‌های پیش‌فرض از کمپین و کار انتخاب‌شده پیروی می‌کنند.</p>
    </details>
    <button className="primary content-generate" aria-label={saved?'ساخت مجدد با ایده تازه':'ساخت محتوا'} disabled={busy||(saved?!text.trim():dirty)} onClick={()=>void perform(saved?'regenerate':'generate')}><span aria-hidden="true">✧</span> {saved?'تولید دوباره با هوش مصنوعی':'تولید با هوش مصنوعی'}</button>
    <p className="wizard-hint">تولید و بازنویسی با AI هزینه دارد. خروجی، متن یا سناریو است.</p>
  </fieldset>;
  const body=<>
    {settingsTarget?createPortal(settings,settingsTarget):settings}
    {!inline&&<button className="close" disabled={busy} aria-label="بستن و نگهداری پیش‌نویس" onClick={onClose}>×</button>}
    <div className="content-editor-heading"><h2 id="content-title">محتوای پیشنهادی</h2><span className="content-draft-badge">{dirty?'ویرایش ذخیره‌نشده':saved?'ذخیره‌شده':'پیش‌نویس'}</span></div>
    <div className="content-revision-actions">{([['shorter','کوتاه‌تر'],['friendly','صمیمی‌تر'],['direct','دعوت روشن‌تر']] as const).map(([action,label])=><button className="outline" key={action} disabled={busy||!saved||!text.trim()} onClick={()=>void perform(action)}><span aria-hidden="true">↻</span> {label}</button>)}</div>
    <div className="content-editing-surface">
      <RichContentEditor value={text} onChange={edit} disabled={busy}/>
      <div className="content-editor-caption"><span>{task.title}</span><span>{text.length.toLocaleString('fa-IR')} / ۱۲٬۰۰۰</span></div>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}<p className="content-editor-status" role="status">{busy?'در حال انجام؛ کمی صبر کن…':notice}</p>
    <div className="editor-actions">
      {onComplete&&<button className="primary" disabled={busy||dirty||completing||!saved} onClick={onComplete}><span aria-hidden="true">✓</span> {completing?'در حال ثبت…':'انجام دادم'}</button>}
      <button className="outline" disabled={busy||!dirty||!text.trim()} onClick={()=>void perform('save')} aria-label="ذخیره متن"><span aria-hidden="true">✓</span> ذخیره متن</button>
      <button className="outline" disabled={!text.trim()} onClick={()=>void copy()} aria-label="کپی"><span aria-hidden="true">▣</span> کپی متن</button>
      {dirty&&<small>تغییراتت را ذخیره کن.</small>}
    </div>
    {previous&&<button className="text-button" disabled={busy||dirty} onClick={()=>{edit(previous);setPrevious(null);setNotice('متن قبلی برگشت؛ برای ثبت نهایی ذخیره متن را بزن.');}}>برگرداندن متن قبل از آخرین بازنویسی</button>}
  </>;
  return inline?<section className="inline-content-editor day-card" aria-labelledby="content-title">{body}</section>:<dialog ref={dialog} aria-labelledby="content-title" className="content-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>{body}</dialog>;
}

'use client';
import { useEffect, useRef, useState } from 'react';
type ContentTask = {id:string;title:string;content?:string|null;cta?:string;why?:string};
export default function ContentEditor({task,onClose,onSaved,inline=false}:{inline?:boolean;task:ContentTask;onClose:()=>void;onSaved:(id:string,content:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const key='campaign-content-draft-'+task.id;
  const [text,setText]=useState(task.content || '');
  const [saved,setSaved]=useState<string|null>(task.content ?? null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [previous,setPrevious]=useState<string|null>(null);
  const [rewrite,setRewrite]=useState('shorter');
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
        body:JSON.stringify(manual?{content:text,expectedContent:saved}:{action})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:'ذخیره انجام نشد. متن تو حفظ شده است.');
      if(!manual&&version)setPrevious(version);
      setText(result.content);setSaved(result.content);onSaved(task.id,result.content);
      localStorage.removeItem(key);setNotice(manual?'متن ذخیره شد.':'محتوا ساخته و ذخیره شد؛ قبل از انتشار بررسی کن.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(text);setNotice('متن کپی شد.');}
    catch {setError('کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کن.');}
  }
  const body=<>
    {!inline&&<button className="close" disabled={busy} aria-label="بستن و نگهداری پیش‌نویس" onClick={onClose}>×</button>}
    <h2 id="content-title">محتوای این کار</h2><h3>{task.title}</h3><p className="wizard-hint">{task.why}</p>{task.cta&&<p>اقدام مخاطب: {task.cta}</p>}
    <label className="field">متن قابل ویرایش<textarea autoFocus rows={12} maxLength={12000} value={text} disabled={busy} onChange={e=>{setText(e.target.value);try {localStorage.setItem(key,e.target.value);} catch {}}}/></label>
    {dirty&&<p className="wizard-hint">با انتخاب بازنویسی یا ساخت مجدد، ابتدا ویرایش فعلی‌ات ذخیره می‌شود.</p>}
    <p className="wizard-hint">تولید و بازنویسی با هوش مصنوعی هزینه API دارد. ذخیره دستی و کپی درخواست AI نمی‌فرستند.</p>
    {error&&<p className="error" role="alert">{error}</p>}<p role="status">{busy?'در حال انجام؛ ممکن است دو دقیقه طول بکشد…':notice}</p>
    <div className="editor-actions">
      {!saved&&<button className="primary" disabled={busy||dirty} onClick={()=>void perform('generate')}>ساخت محتوا</button>}
      {saved&&<button className="primary" disabled={busy||!text.trim()} onClick={()=>void perform('regenerate')}>ساخت مجدد با ایده تازه</button>}
      <button className={saved?'primary':'outline'} disabled={busy||!dirty||!text.trim()} onClick={()=>void perform('save')}>ذخیره متن</button>
      <button className="outline" disabled={!text.trim()} onClick={()=>void copy()}>کپی</button>
    </div>
    {saved&&<div className="rewrite-controls"><label className="field">نوع بازنویسی<select value={rewrite} disabled={busy} onChange={e=>setRewrite(e.target.value)}><option value="shorter">کوتاه‌تر؛ حذف اضافه‌ها</option><option value="friendly">صمیمی‌تر؛ تغییر لحن</option><option value="direct">اقدام روشن‌تر؛ دعوت مشخص</option></select></label><button className="outline" disabled={busy||!text.trim()} onClick={()=>void perform(rewrite)}>اجرای بازنویسی</button></div>}
    {previous&&<button className="text-button" disabled={busy||dirty} onClick={()=>{setText(previous);try {localStorage.setItem(key,previous);} catch {} setPrevious(null);setNotice('متن قبلی برگشت؛ برای ثبت نهایی «ذخیره متن» را بزن.');}}>برگرداندن متن قبل از آخرین بازنویسی</button>}
  </>;
  return inline?<section className="inline-content-editor day-card" aria-labelledby="content-title">{body}</section>:<dialog ref={dialog} aria-labelledby="content-title" className="content-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>{body}</dialog>;
}

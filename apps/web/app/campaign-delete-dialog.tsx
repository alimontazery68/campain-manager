'use client';
import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export type DeletionPreview={token:string;name:string;days:number;tasks:number;results:number};

export default function CampaignDeleteDialog({preview,returnFocusTo,name,confirmed,busy,error,onName,onConfirm,onDelete,onClose}:{
 returnFocusTo:HTMLElement|null;
 preview:DeletionPreview;name:string;confirmed:boolean;busy:boolean;error:string;
 onName:(value:string)=>void;onConfirm:(value:boolean)=>void;onDelete:()=>void;onClose:()=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null),cancelButton=useRef<HTMLButtonElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const previous=returnFocusTo??document.activeElement as HTMLElement|null;
  dialog.current?.showModal();
  cancelButton.current?.focus({preventScroll:true});
  return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[returnFocusTo]);
 return <dialog ref={dialog} className="content-dialog campaign-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <button type="button" className="close" aria-label="بستن تأیید حذف" disabled={busy} onClick={onClose}><X size={20}/></button>
  <div className="delete-dialog-icon"><Trash2 size={24}/></div>
  <h2 id={titleId}>حذف کمپین «{preview.name}»؟</h2>
  <p id={descriptionId} className="wizard-hint">با حذف این کمپین، برنامه، محتواها، نتایج، آماده‌سازی و سوابق آن برای همیشه حذف می‌شوند.</p>
  <div className="delete-dialog-counts">{([[preview.days,'روز برنامه'],[preview.tasks,'کار'],[preview.results,'نتیجه ثبت‌شده']] as const).map(([count,label])=><div key={label}><strong>{count.toLocaleString('fa-IR')}</strong><span>{label}</span></div>)}</div>
  <p className="delete-dialog-warning"><AlertTriangle size={18} aria-hidden="true"/>این کار از داخل برنامه قابل بازگرداندن نیست. اگر لازم داری، ابتدا گزارش اکسل را دانلود کن.</p>
  <form onSubmit={e=>{e.preventDefault();if(!busy&&confirmed&&name===preview.name)onDelete();}} aria-busy={busy}>
   <label className="field">برای تأیید حذف، نام کمپین را دقیقاً بنویس<input value={name} disabled={busy} autoComplete="off" spellCheck={false} onChange={e=>onName(e.target.value)}/></label>
   <label className="delete-dialog-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>onConfirm(e.target.checked)}/><span>می‌دانم حذف دائمی است و از داخل برنامه قابل بازگرداندن نیست.</span></label>
   {error&&<p role="alert" className="error">{error}</p>}
   <div className="editor-actions delete-dialog-actions"><button ref={cancelButton} type="button" className="outline" disabled={busy} onClick={onClose}>انصراف از حذف</button><button type="submit" className="primary delete-confirm-button" disabled={busy||!confirmed||name!==preview.name}><Trash2 size={17}/>{busy?'در حال حذف…':'حذف دائمی همین کمپین'}</button></div>
  </form>
 </dialog>;
}

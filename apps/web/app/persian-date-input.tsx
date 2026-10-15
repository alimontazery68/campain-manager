'use client';
import DisclosureSummary from './disclosure-summary';
import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isoToPersian, persianDateText, persianToIso } from './persian-date';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export default function PersianDateInput({value,onChange,disabled,label="تاریخ شروع جدید (شمسی)",required=true}:{value:string;onChange:(value:string)=>void;disabled:boolean;label?:string;required?:boolean}){
 const id=useId(),calendar=useRef<HTMLDetailsElement>(null),[touched,setTouched]=useState(false);
 const valid=persianToIso(value);
 const todayIso=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [year,setYear]=useState(()=>Number(isoToPersian(valid||todayIso).split('/')[0]));
 const [month,setMonth]=useState(()=>Number(isoToPersian(valid||todayIso).split('/')[1]));
 const first=persianToIso(persianDateText(year,month,1))!;
 const offset=(new Date(first+'T12:00:00Z').getUTCDay()+1)%7;
 const count=persianToIso(persianDateText(year,month,31))?31:persianToIso(persianDateText(year,month,30))?30:29;
 function move(delta:number){const next=month+delta;if(next===0){setMonth(12);setYear(year-1);}else if(next===13){setMonth(1);setYear(year+1);}else setMonth(next);}
 return <div className="field persian-date-field"><label htmlFor={id}>{label}</label><input id={id} dir="ltr" type="text" inputMode="numeric" required={required} maxLength={10} placeholder="۱۴۰۵/۰۸/۱۰" value={value} disabled={disabled} aria-describedby={id+'-help'} aria-invalid={touched&&(required||!!value.trim())&&!valid} onBlur={()=>setTouched(true)} onChange={e=>onChange(e.target.value)}/><small id={id+'-help'}>{touched&&(required||!!value.trim())&&!valid?'تاریخ شمسی معتبر وارد کن؛ مانند ۱۴۰۵/۰۸/۱۰.':'سال / ماه / روز؛ امکان ورود با ارقام فارسی'}</small><details ref={calendar} className="persian-calendar" onToggle={e=>{if(e.currentTarget.open){const p=isoToPersian(valid||todayIso).split('/').map(Number);setYear(p[0]);setMonth(p[1]);}}}><DisclosureSummary icon="calendar" aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}}>انتخاب از تقویم شمسی</DisclosureSummary><div className="persian-calendar-heading"><button type="button" disabled={disabled||year<=1000&&month===1} aria-label="ماه قبل" onClick={()=>move(-1)}><ChevronRight size={16}/></button><strong>{months[month-1]} {year.toLocaleString('fa-IR',{useGrouping:false})}</strong><button type="button" disabled={disabled||year>=2999&&month===12} aria-label="ماه بعد" onClick={()=>move(1)}><ChevronLeft size={16}/></button></div><div className="persian-calendar-grid">{['ش','ی','د','س','چ','پ','ج'].map((name,index)=><span className="calendar-weekday" key={index}>{name}</span>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{const text=persianDateText(year,month,i+1),selected=persianToIso(text)===valid;return <button type="button" disabled={disabled} aria-pressed={selected} aria-label={`${i+1} ${months[month-1]} ${year}`} className={selected?'selected':''} key={i} onClick={()=>{onChange(text);setTouched(true);if(calendar.current)calendar.current.open=false;}}>{(i+1).toLocaleString('fa-IR')}</button>;})}</div></details></div>;
}

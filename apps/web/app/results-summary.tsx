'use client';
import type { DailyResult } from './daily-results';
import ResultsTrend from './results-trend';
type Day={id:string;dayNumber:number;result?:DailyResult|null};
export default function ResultsSummary({days}:{days:Day[]}) {
  const recorded=days.filter(d=>d.result);
  if(!recorded.length)return <section className="day-card"><h2>گزارش عملکرد</h2><p>هنوز نتیجه‌ای ثبت نشده است. روز موردنظر را انتخاب و نتیجه واقعی آن را ثبت کن.</p></section>;
  const sum=(field:'views'|'leads'|'sales'|'revenue')=>recorded.some(d=>d.result?.[field]!=null)?recorded.reduce((total,d)=>total+Number(d.result?.[field]??0),0):null;
  const metrics=[['بازدید',sum('views')],['سرنخ',sum('leads')],['فروش',sum('sales')],['درآمد (تومان)',sum('revenue')]] as const;
  // Include only days with both measurements in the conversion denominator.
  const paired=recorded.filter(d=>d.result?.leads!=null&&d.result.sales!=null);
  const leads=paired.reduce((s,d)=>s+d.result!.leads!,0),sales=paired.reduce((s,d)=>s+d.result!.sales!,0);
  return <section className="day-card"><h2>گزارش عملکرد ثبت‌شده</h2><div className="dashboard-summary">{metrics.map(([label,value])=><article className="stat-card" key={label}><span>{label}</span><strong>{value==null?'—':value.toLocaleString('fa-IR')}</strong></article>)}</div><p>نسبت فروش به سرنخ: {leads>0?(100*sales/leads).toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪':'—'}</p><small>فقط روزهایی محاسبه می‌شوند که هم فروش و هم سرنخ ثبت شده‌اند؛ هر فروش الزاماً یک خریدار یکتا نیست.</small><ResultsTrend days={days}/></section>;
}

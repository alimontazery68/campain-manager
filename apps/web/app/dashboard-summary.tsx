import {Users,ShoppingBag,Wallet} from 'lucide-react';
import type { DailyResult } from './daily-results';

type Campaign = { status:string; days:{tasks:{status:string;archived?:boolean}[];result?:DailyResult|null}[] };

export default function DashboardSummary({campaigns}:{campaigns:Campaign[]}) {
  const results=campaigns.flatMap(c=>c.days.map(d=>d.result).filter(Boolean) as DailyResult[]);
  const leads=results.reduce((sum,r)=>sum+(r.leads??0),0);
  const sales=results.reduce((sum,r)=>sum+(r.sales??0),0);
  const revenue=results.some(r=>r.revenue!=null)?results.reduce((sum,r)=>sum+Number(r.revenue??0),0):null;
  return <section className="dashboard-summary" aria-label="آمار واقعی داشبورد">{[['سرنخ ثبت‌شده',results.some(r=>r.leads!=null)?leads.toLocaleString('fa-IR'):'نامعلوم'],['فروش ثبت‌شده',results.some(r=>r.sales!=null)?sales.toLocaleString('fa-IR'):'نامعلوم'],['درآمد ثبت‌شده',revenue==null?'—':revenue.toLocaleString('fa-IR')+' تومان']].map(([label,value],index)=>{const Icon=[Users,ShoppingBag,Wallet][index];return <article className="stat-card" key={label}><span><Icon size={16} aria-hidden="true"/>{label}</span><strong>{value}</strong></article>;})}</section>;
}

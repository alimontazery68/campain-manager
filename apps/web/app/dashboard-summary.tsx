import type { DailyResult } from './daily-results';

type Campaign = { status:string; days:{tasks:{status:string;archived?:boolean}[];result?:DailyResult|null}[] };

export default function DashboardSummary({campaigns}:{campaigns:Campaign[]}) {
  const active=campaigns.filter(c=>c.status==='ACTIVE').length;
  const completedTasks=campaigns.flatMap(c=>c.days.flatMap(d=>d.tasks)).filter(t=>!t.archived&&t.status==='DONE').length;
  const results=campaigns.flatMap(c=>c.days.map(d=>d.result).filter(Boolean) as DailyResult[]);
  const leads=results.reduce((sum,r)=>sum+(r.leads??0),0);
  const sales=results.reduce((sum,r)=>sum+(r.sales??0),0);
  const revenue=results.some(r=>r.revenue!=null)?results.reduce((sum,r)=>sum+Number(r.revenue??0),0):null;
  return <section className="dashboard-summary" aria-label="آمار واقعی داشبورد">{[['کمپین فعال',active.toLocaleString('fa-IR')],['کار انجام‌شده',completedTasks.toLocaleString('fa-IR')],['سرنخ ثبت‌شده',results.some(r=>r.leads!=null)?leads.toLocaleString('fa-IR'):'نامعلوم'],['فروش ثبت‌شده',results.some(r=>r.sales!=null)?sales.toLocaleString('fa-IR'):'نامعلوم'],['درآمد ثبت‌شده',revenue==null?'—':revenue.toLocaleString('fa-IR')+' تومان']].map(([label,value])=><article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>;
}

'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Sparkles } from 'lucide-react';
import PlanReview from './plan-review';
import ContentEditor from './content-editor';
import { request } from './api';
import DailyResults, { type DailyResult } from './daily-results';
import CampaignAnalysis from './campaign-analysis';
import CampaignCompletion from './campaign-completion';
import PreparationChecklist from './preparation-checklist';
import TaskControls from './task-controls';
import CampaignLearning from './campaign-learning';
import CampaignHistory from './campaign-history';
import PlanEditor from './plan-editor';
import MissionGuidance from './mission-guidance';
import CampaignReport from './campaign-report';
import CampaignFacts from './campaign-facts';
import SetupEditor from './setup-editor';
import DashboardSummary from './dashboard-summary';
import ResultsSummary from './results-summary';
import SimpleCampaignWizard from './campaign-wizard';
import AuthScreen from './auth-screen';
import CampaignManagement from './campaign-management';
type Task = { id: string; title: string; type: string; status: string; why?: string; cta?: string; content?:string|null;format?:string|null;objective?:string|null;requiredAsset?:string|null;locked:boolean;updatedAt:string;position:number;preparationIds:string[];metadata?:{timeSlot?:string|null;contentFunction?:string|null;topic?:string|null;angle?:string|null;hookDirection?:string|null;keyPoints?:string[]}|null };
type Day = { id: string; dayNumber: number; date: string; phase: string; mission: string; objective: string; tasks: Task[]; result?:DailyResult|null;guidance?:{audienceStateBefore?:string;desiredAudienceStateAfter?:string;successSignals?:string[];ctaIntensity?:number;decisionPoint?:boolean;decisionCriteria?:{whatToCheck:string[];possibleSignals:string[];possibleResponses:string[]}|null} };
type AiPlan = { strategy:string; bigIdea:string; coreMessage:string; assumptions:string[]; phases:{name:string;objective:string;startDay:number;endDay:number}[]; preparation:{title:string;why:string;requiredBeforeDay?:number}[]; days:{dayNumber:number;mission:string;objective:string;decisionPoint:boolean;tasks:{title:string;why:string}[]}[] };
type Campaign = { id: string; name: string; duration: number; status: string; product: string; audience?: string; days: Day[]; aiPlan?:AiPlan; maxContentPerDay:number;completion?:{learnings:string[]}|null;preparationTasks:{id:string;title:string;completed:boolean}[];updatedAt:string };
const fa = (n: number) => n.toLocaleString('fa-IR');

function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState('');
  const [selectedDay,setSelectedDay]=useState('');
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [simpleWizard,setSimpleWizard]=useState(false);
  const wizard=simpleWizard;
  const setWizard=setSimpleWizard;
  const [planning, setPlanning] = useState(false);
  const [editingTask,setEditingTask] = useState<Task|null>(null);
  async function load() {
    setLoading(true); setError('');
    try { setCampaigns(await request<Campaign[]>('campaigns')); } catch(e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); }, []);
  const campaign = campaigns.find(c=>c.id===selected) || campaigns[0];
  useEffect(()=>{if(!loading&&!campaign&&view!=='dashboard')setView('dashboard');}, [campaign,loading,view]);
  async function reloadCampaign(){if(!campaign)return;const result=await request<Campaign>('campaigns/'+campaign.id);setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));}
  const guidance=(d:Day)=>d.guidance||campaign?.aiPlan?.days.find(p=>p.dayNumber===d.dayNumber);
  const controls=(d:Day)=><TaskControls key={d.id+':'+d.mission+':'+d.objective+':'+d.phase} day={d} days={campaign!.days} preparation={campaign!.preparationTasks||[]} changed={reloadCampaign}/>;
  const todayKey = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const day = campaign?.days.find(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.date))===todayKey);
  const workDay=campaign?.days.find(d=>d.id===selectedDay)||day||campaign?.days[0];
  const allTasks = campaign?.days.flatMap(d=>d.tasks) || [];
  const progress = allTasks.length ? Math.round(100*allTasks.filter(t=>t.status==='DONE').length/allTasks.length) : 0;
  async function complete(task:Task) {
    if(pending || task.status!=='PENDING' || campaign?.status!=='ACTIVE') return;
    setPending(task.id); setError('');
    try {
      const result=await request<Task>('campaigns/tasks/'+task.id+'/complete',{method:'PATCH'});
      setCampaigns(cs=>cs.map(c=>({...c,days:c.days.map(d=>({...d,tasks:d.tasks.map(t=>t.id===result.id?result:t)}))})));
    } catch(e) {setError((e as Error).message);} finally {setPending('');}
  }
  async function planAction(action:'plan'|'approve') {
    if(!campaign||planning) return;
    setPlanning(true);setError('');
    try {
      await request('campaigns/'+campaign.id+'/'+action,{method:'POST'});
      const result=await request<Campaign>('campaigns/'+campaign.id);
      setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));
    } catch(e) {setError((e as Error).message);} finally {setPlanning(false);}
  }
  const resultForm=(d:Day)=><DailyResults key={d.id} dayId={d.id} result={d.result} future={new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.date))>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())} onSaved={result=>setCampaigns(cs=>cs.map(c=>({...c,days:c.days.map(day=>day.id===d.id?{...day,result}:day)})))}/>;
  const taskCards = (tasks:Task[]) => <div className="tasks">{tasks.map(task=><article className={'task '+(task.status==='DONE'?'is-done':'')} key={task.id}>
    <button className="check" aria-label={task.status==='DONE'?'انجام شده':'ثبت انجام کار'} disabled={!!pending || task.status!=='PENDING'} onClick={()=>void complete(task)}>{task.status==='DONE'&&<CheckCircle2 size={22}/>}</button>
    <div className="task-body"><span className={'tag '+(task.type==='CONTENT'?'blue':'purple')}>{({CONTENT:'محتوا',OPERATIONAL:'عملیاتی',SALES:'فروش',SUPPORT:'پشتیبانی',PREPARATION:'آماده‌سازی',FOLLOW_UP:'پیگیری محترمانه',MEASUREMENT:'اندازه‌گیری'} as Record<string,string>)[task.type]}{task.format?' · '+task.format:''}{task.locked?' · قفل‌شده':''}{task.status==='SKIPPED'?' · ردشده':''}</span><h3>{task.title}</h3>{task.objective&&<p>هدف: {task.objective}</p>}<p className="task-meta">{task.why}</p>{task.cta&&<small>اقدام مخاطب: {task.cta}</small>}{task.preparationIds?.map(id=>{const p=campaign?.preparationTasks?.find(p=>p.id===id);return p?<p key={id} className={p.completed?'wizard-hint':'error'}>پیش‌نیاز: {p.title} · {p.completed?'آماده':'آماده نشده؛ قبل از اجرا بررسی کن'}</p>:null;})}{task.content&&(task.locked||task.status!=='PENDING')&&<details><summary>مشاهده متن محفوظ</summary><p style={{whiteSpace:'pre-wrap'}}>{task.content}</p><button className="outline" onClick={()=>void navigator.clipboard.writeText(task.content||'')}>کپی</button></details>}</div>
    <button className="outline" disabled={!!pending || task.status!=='PENDING'} onClick={()=>void complete(task)}>{pending===task.id?'در حال ثبت…':task.status==='DONE'?'انجام شد':task.status==='SKIPPED'?'ردشده':'انجام دادم'}</button>
    {task.type==='CONTENT'&&task.status==='PENDING'&&!task.locked&&<button className="outline" disabled={planning||campaign?.status!=='ACTIVE'} onClick={()=>setEditingTask(task)}>{task.content?'بازکردن محتوا':'ساخت / نوشتن محتوا'}</button>}
  </article>)}</div>;
  const navItems=[['dashboard','داشبورد'],['campaigns','کمپین‌های من'],['reports','گزارش‌ها'],['settings','تنظیمات']];
  return <main className="shell"><aside><div className="brand"><div className="logo"><Sparkles size={19}/></div>کمپین‌منیجر</div><nav>{navItems.map(([key,label])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}</nav><div className="aside-help"><p>قدم بعدی‌ات را با هم پیدا می‌کنیم.</p></div></aside>
    <section className="content"><header><div><span className="eyebrow">{new Intl.DateTimeFormat('fa-IR',{dateStyle:'full',timeZone:'Asia/Tehran'}).format(new Date())}</span><h1>فضای کار کمپین‌های تو</h1></div><button className="primary" onClick={()=>{setWizard(true);setError('');}}><Plus size={18}/>کمپین جدید</button></header>
    {campaign&&['plan','today','results','audience'].includes(view)&&<nav className="workspace-tabs" aria-label="بخش‌های کمپین"><button className={view==='plan'?'active':''} onClick={()=>setView('plan')}>برنامه</button><button className={view==='today'?'active':''} onClick={()=>setView('today')}>محتوا</button><button className={view==='results'?'active':''} onClick={()=>setView('results')}>نتایج</button><button className={view==='audience'?'active':''} onClick={()=>setView('audience')}>اطلاعات</button></nav>}
      {view==='dashboard'&&<DashboardSummary campaigns={campaigns}/>}<nav className="mobile-nav">{navItems.map(([key,label])=><button data-nav={key} key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}</nav>
      {error&&!wizard&&<div role="alert" className="error">{error}<button onClick={()=>void load()}>تلاش دوباره</button></div>}
      {loading?<p role="status">در حال خواندن کمپین‌ها…</p>:!campaign?<div className="empty-state"><Sparkles/><h2>اولین کمپینت رو بساز</h2><p>محصول و هدفت را بگو تا فضای اجرای کمپینت آماده شود.</p><button className="primary" onClick={()=>setWizard(true)}>ساخت کمپین</button></div>:<>
        {view==='dashboard'?<><h2>سلام، امروز چه کارهایی داریم؟</h2><p>کمپین‌هایت را مدیریت کن و قدم بعدی را بردار.</p><div className="campaign-list">{campaigns.map(c=>{const tasks=c.days.flatMap(d=>d.tasks),done=tasks.filter(t=>t.status==='DONE').length,current=c.days.find(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran'}).format(new Date(d.date))===todayKey);return <button className="campaign-card" key={c.id} onClick={()=>{setSelected(c.id);setView(c.status==='DRAFT'?'plan':c.status==='COMPLETED'?'results':'today');}}><strong>{c.name}</strong><span>{({DRAFT:'پیش‌نویس',ACTIVE:'در حال اجرا',COMPLETED:'پایان‌یافته',PAUSED:'متوقف'} as Record<string,string>)[c.status]||c.status} · {fa(c.duration)} روز</span><span>{current?'روز '+fa(current.dayNumber)+' از '+fa(c.duration):'امروز روز اجرایی ندارد'}</span><span>{fa(done)} از {fa(tasks.length)} کار انجام شده</span><span>{c.status==='DRAFT'?'بررسی و ساخت برنامه':c.status==='COMPLETED'?'مشاهده گزارش نهایی':current?.tasks.find(t=>t.status==='PENDING')?.title||'مشاهده برنامه اجرا'} ←</span></button>;})}</div></>:view==='campaigns'?<><h2>کمپین‌های من</h2><div className="campaign-list">{campaigns.map(c=><button className="campaign-card" key={c.id} onClick={()=>{setSelected(c.id);setView('plan');}}><strong>{c.name}</strong><span>{fa(c.duration)} روز · {c.status==='DRAFT'?'پیش‌نویس':c.status==='COMPLETED'?'پایان‌یافته':c.status==='PAUSED'?'متوقف':'در حال اجرا'}</span><span>مشاهده برنامه ←</span></button>)}</div></>:view==='reports'?<><h2>گزارش‌ها</h2><p className="wizard-hint">نتایج کمپین انتخاب‌شده را در یک نمای ساده ببین.</p><label className="field">کمپین گزارش<select value={campaign.id} onChange={e=>setSelected(e.target.value)}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><ResultsSummary days={campaign.days}/><CampaignReport id={campaign.id} name={campaign.name}/><CampaignAnalysis campaignId={campaign.id} days={campaign.days} hasResults={campaign.days.some(d=>!!d.result)} onApplied={reloadCampaign}/></>:view==='settings'?<section className="settings-panel"><h2>تنظیمات</h2><p>تنظیمات پیشرفته هر کمپین داخل همان کمپین نگه‌داری می‌شود تا مسیر کار کوتاه بماند.</p><details><summary>راهنمای شروع سریع</summary><p>از «کمپین جدید» شروع کن، هدف و مخاطب را وارد کن و در هر مرحله ذخیره و ادامه بده. پیشنهادهای هوش مصنوعی قبل از ثبت نهایی قابل ویرایش هستند.</p></details></section>:view==='audience'?<><h2>مخاطبان و فروش</h2><p className="wizard-hint">تعریف مخاطب، پیشنهاد و مسیر اقدام از همین‌جا و داخل کمپین انتخاب‌شده انجام می‌شود.</p><CampaignFacts value={campaign}/><SetupEditor key={'audience:'+campaign.id+campaign.updatedAt} campaign={campaign} changed={reloadCampaign}/></>:<>
          {campaigns.length>1&&<label className="field">کمپین انتخاب‌شده<select disabled={planning} value={campaign.id} onChange={e=>setSelected(e.target.value)}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {(view==='plan'||campaign.status==='DRAFT')&&<PlanReview plan={campaign.aiPlan} status={campaign.status} duration={campaign.duration} busy={planning} action={v=>void planAction(v)}/>}
          <CampaignFacts value={campaign}/>
          <SetupEditor key={campaign.id+campaign.updatedAt} campaign={campaign} changed={async value=>{if(value&&value.id!==campaign.id){const result=await request<Campaign>('campaigns/'+value.id);setCampaigns(cs=>[result,...cs.filter(c=>c.id!==result.id)]);setSelected(result.id);setView('plan');}else await reloadCampaign();}}/>
          <CampaignManagement key={'manage:'+campaign.id+campaign.updatedAt} campaign={campaign} changed={reloadCampaign} removed={id=>{setCampaigns(cs=>cs.filter(c=>c.id!==id));setSelected('');setEditingTask(null);setView('campaigns');}}/>
          {campaign.status==='DRAFT'&&campaign.aiPlan&&<PlanEditor key={JSON.stringify(campaign.aiPlan)} id={campaign.id} plan={campaign.aiPlan} changed={reloadCampaign}/>}
          {(campaign.status==='ACTIVE'||campaign.status==='COMPLETED')&&<PreparationChecklist key={'preparation:'+campaign.id} id={campaign.id} status={campaign.status} days={campaign.days} planned={campaign.aiPlan?.preparation||[]} changed={reloadCampaign}/>}
          {campaign.status==='ACTIVE'&&<section className="day-card"><h2>قدم بعدی</h2>{day?<><MissionGuidance value={guidance(day)} objective={day.objective} analyze={()=>document.getElementById('campaign-analysis')?.scrollIntoView({behavior:'smooth'})}/>{controls(day)}</>:<p>روز مناسب را از برنامه اجرا انتخاب کن.</p>}<details><summary>کنترل روزهای دیگر</summary>{campaign.days.filter(d=>d.id!==day?.id).map(d=><section className="day-card" key={d.id}><h3>روز {fa(d.dayNumber)}</h3><MissionGuidance value={guidance(d)} objective={d.objective} analyze={()=>document.getElementById('campaign-analysis')?.scrollIntoView({behavior:'smooth'})}/>{controls(d)}</section>)}</details></section>}
          {campaign.status==='COMPLETED'&&<CampaignLearning key={'learning:'+campaign.id} id={campaign.id} confirmed={reloadCampaign}/>}
          <CampaignHistory key={'history:'+campaign.id} id={campaign.id}/>
          <CampaignReport id={campaign.id} name={campaign.name}/>
          {campaign.status==='ACTIVE'&&<><div className="hero"><div><span className="pill orange">{campaign.status==='ACTIVE'?'طرح تأییدشده':campaign.aiPlan?'طرح آماده بررسی':'برنامه اولیه · بدون هوش مصنوعی'}</span><h2>{campaign.name}</h2><p>{day?'روز '+fa(day.dayNumber)+' از '+fa(campaign.duration)+' · '+day.phase:'برای امروز روزی در برنامه نیست'}</p><div className="progress"><span style={{width:progress+'%'}}/></div><small>{fa(progress)}٪ کارها انجام شده</small></div><div className="hero-cta"><strong>{day?'ماموریت امروز':'برنامه کمپین'}</strong><p>{day?.mission || 'روزها و کارهای ثبت‌شده را در برنامه ببین.'}</p><button className="secondary" onClick={()=>setView(view==='plan'?'today':'plan')}>{view==='plan'?'اجرای امروز':'مشاهده برنامه'}</button><button className="secondary" style={{marginTop:12}} onClick={()=>setView('results')}>ثبت و مشاهده نتایج</button></div></div>
          {(view==='plan'||view==='results')?<>{view==='results'&&<ResultsSummary days={campaign.days}/>}<h2>{view==='results'?'نتایج روزهای کمپین':'برنامه اجرا'}</h2><p className="wizard-hint">{campaign.status==='ACTIVE'?'برنامه تأییدشده تو برای اجرا آماده است.':'تا پیش از تأیید طرح، برنامه اولیه نمایش داده می‌شود.'}</p><label className="field">انتخاب روز کمپین<select value={campaign.days.some(d=>d.id===selectedDay)?selectedDay:(day?.id||campaign.days[0]?.id||'')} onChange={e=>setSelectedDay(e.target.value)}>{campaign.days.map(d=><option key={d.id} value={d.id}>روز {fa(d.dayNumber)} · {d.mission} · {fa(d.tasks.filter(t=>t.status==='DONE').length)} از {fa(d.tasks.length)} انجام‌شده</option>)}</select></label><div className="timeline">{campaign.days.filter(d=>d.id===(campaign.days.some(d=>d.id===selectedDay)?selectedDay:(day?.id||campaign.days[0]?.id))).map(d=><article className="day-card" key={d.id}><span className="eyebrow">روز {fa(d.dayNumber)} · {new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(d.date))} {d.id===day?.id?' · امروز':''}</span><h3>{d.phase} — {d.mission}</h3><p>{d.objective}</p>{view==='results'?resultForm(d):taskCards(d.tasks)}</article>)}</div></>:<><label className="field">روز محتوا<select value={workDay?.id||''} onChange={e=>setSelectedDay(e.target.value)}>{campaign.days.map(d=><option key={d.id} value={d.id}>روز {fa(d.dayNumber)} · {d.mission}</option>)}</select></label><div className="section-title"><h2>کارهای روز انتخاب‌شده</h2>{workDay&&<small>{fa(workDay.tasks.filter(t=>t.status==='DONE').length)} از {fa(workDay.tasks.length)} کار انجام شده</small>}</div>{workDay?<>{taskCards(workDay.tasks)}{resultForm(workDay)}</>:<p>امروز خارج از بازه این کمپین است. برنامه را ببین.</p>}</>}
          </>}
          {campaign.status==='ACTIVE'&&<CampaignAnalysis key={'analysis:'+campaign.id} campaignId={campaign.id} days={campaign.days} hasResults={campaign.days.some(d=>!!d.result)} onApplied={async()=>{const result=await request<Campaign>('campaigns/'+campaign.id);setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));}}/>}
          {(campaign.status==='ACTIVE'||campaign.status==='COMPLETED')&&<CampaignCompletion key={'completion:'+campaign.id} id={campaign.id} completed={campaign.status==='COMPLETED'} onCompleted={async()=>{const result=await request<Campaign>('campaigns/'+campaign.id);setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));}}/>}
          {campaign.status==='COMPLETED'&&<><h2>برنامه نهایی · فقط مشاهده</h2>{campaign.days.map(d=><article className="day-card" key={d.id}><h3>روز {fa(d.dayNumber)} — {d.mission}</h3>{d.tasks.map(t=><details key={t.id}><summary>{t.title} · {t.status==='DONE'?'انجام‌شده':'انجام‌نشده'}</summary><p style={{whiteSpace:'pre-wrap'}}>{t.content||t.why}</p></details>)}</article>)}</>}
          {campaign.status==='DRAFT'&&<p className="wizard-hint">برنامه اجرا و کارهای امروز فقط پس از تأیید طرح نمایش داده می‌شوند.</p>}
        </>}
      </>}
    </section>
    {editingTask&&<ContentEditor key={editingTask.id} task={editingTask} onClose={()=>setEditingTask(null)} onSaved={(id,content)=>{
      setEditingTask(t=>t&&t.id===id?{...t,content}:t);
      setCampaigns(cs=>cs.map(c=>({...c,days:c.days.map(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,content}:t)}))})));
      void reloadCampaign().catch(e=>setError((e as Error).message));
    }}/>}

    <button className="logout-button" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'include'});window.location.reload();}}>خروج از حساب</button>
    {simpleWizard&&<SimpleCampaignWizard<Campaign> previousCampaigns={campaigns} onClose={()=>setSimpleWizard(false)} onCreated={result=>{setCampaigns(cs=>[result,...cs]);setSelected(result.id);setView('plan');}}/>}
  </main>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }).then(response => setAuthenticated(response.ok)).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <main className="shell"><section className="content" style={{maxWidth:520,margin:'20vh auto'}}><p>در حال بررسی نشست…</p></section></main>;
  return authenticated ? <Dashboard /> : <AuthScreen onSuccess={() => setAuthenticated(true)} />;
}

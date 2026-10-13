'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Sparkles } from 'lucide-react';
import PlanReview from './plan-review';
import ContentEditor from './content-editor';
import { request } from './api';
import DailyResults, { type DailyResult } from './daily-results';
import CampaignAnalysis from './campaign-analysis';
import CampaignCompletion from './campaign-completion';
import PlanningDetailsForm from './planning-details-form';
import PreparationChecklist from './preparation-checklist';
import TaskControls from './task-controls';
import CampaignLearning from './campaign-learning';
import CampaignHistory from './campaign-history';
import PlanEditor from './plan-editor';
import MissionGuidance from './mission-guidance';
import ContextHelp from './context-help';
import CampaignReport from './campaign-report';
import CampaignFacts from './campaign-facts';
import SetupEditor from './setup-editor';
import CampaignManagement from './campaign-management';
import { buildDetailedInput,emptyDetails,type PlanningDetails } from './planning-details';
type Task = { id: string; title: string; type: string; status: string; why?: string; cta?: string; content?:string|null;format?:string|null;objective?:string|null;requiredAsset?:string|null;locked:boolean;updatedAt:string;position:number;preparationIds:string[];metadata?:{timeSlot?:string|null;contentFunction?:string|null;topic?:string|null;angle?:string|null;hookDirection?:string|null;keyPoints?:string[]}|null };
type Day = { id: string; dayNumber: number; date: string; phase: string; mission: string; objective: string; tasks: Task[]; result?:DailyResult|null;guidance?:{audienceStateBefore?:string;desiredAudienceStateAfter?:string;successSignals?:string[];ctaIntensity?:number;decisionPoint?:boolean;decisionCriteria?:{whatToCheck:string[];possibleSignals:string[];possibleResponses:string[]}|null} };
type AiPlan = { strategy:string; bigIdea:string; coreMessage:string; assumptions:string[]; phases:{name:string;objective:string;startDay:number;endDay:number}[]; preparation:{title:string;why:string;requiredBeforeDay?:number}[]; days:{dayNumber:number;mission:string;objective:string;decisionPoint:boolean;tasks:{title:string;why:string}[]}[] };
type Campaign = { id: string; name: string; duration: number; status: string; product: string; audience?: string; days: Day[]; aiPlan?:AiPlan; maxContentPerDay:number;completion?:{learnings:string[]}|null;preparationTasks:{id:string;title:string;completed:boolean}[];updatedAt:string };
type Draft = { name: string; businessType: string; campaignType: string; product: string; audience: string; problem: string; outcome: string; offer: { kind: string; details: string;regularPrice?:string;campaignPrice?:string;bonus?:string;deadline?:string;capacity?:string;paymentTerms?:string }; salesPath: { action: string; details: string }; duration: number; target: string;details:PlanningDetails;startDate?:string;creationKey?:string };
const empty: Draft = { name: '', businessType: '', campaignType: '', product: '', audience: '', problem: '', outcome: '', offer: {kind: 'پیشنهاد خاصی ندارم', details: ''}, salesPath: {action: '', details: ''}, duration: 7, target: '',details:emptyDetails };
const draftKey = 'campaign-manager-draft-v1';
const titles = ['کسب‌وکارت بیشتر شبیه کدام است؟', 'می‌خواهی کمپین چه کاری انجام دهد؟', 'چه چیزی می‌فروشی؟', 'مخاطبت چه کسانی هستند؟', 'چه پیشنهادی داری؟', 'مخاطب برای اقدام چه کاری انجام دهد؟', 'کمپین چند روز باشد؟', 'اطلاعات را بررسی کن'];
const fa = (n: number) => n.toLocaleString('fa-IR');
function Field({label, value, change, multiline = false}: {label: string; value: string; change: (v:string)=>void; multiline?: boolean}) {
  return <label className="field">{label}{multiline ? <textarea value={value} onChange={e=>change(e.target.value)} rows={3}/> : <input value={value} onChange={e=>change(e.target.value)}/>}</label>;
}
export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState('');
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState('');
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(empty);
  const [hydrated, setHydrated] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [editingTask,setEditingTask] = useState<Task|null>(null);
  const [learningSource,setLearningSource]=useState('');
  async function load() {
    setLoading(true); setError('');
    try { setCampaigns(await request<Campaign[]>('campaigns')); } catch(e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); try {const saved = localStorage.getItem(draftKey); if(saved){const restored=JSON.parse(saved);setDraft({...empty,...restored,details:{...emptyDetails,...restored.details}});}} catch { /* Invalid local draft: use defaults. */ } setHydrated(true); }, []);
  useEffect(()=>{if(hydrated) localStorage.setItem(draftKey, JSON.stringify(draft));}, [draft, hydrated]);
  useEffect(()=>{if(!wizard) return; const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving)setWizard(false);}; document.addEventListener('keydown',handler); return ()=>document.removeEventListener('keydown',handler);}, [wizard,saving]);
  const campaign = campaigns.find(c=>c.id===selected) || campaigns[0];
  async function reloadCampaign(){if(!campaign)return;const result=await request<Campaign>('campaigns/'+campaign.id);setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));}
  const guidance=(d:Day)=>d.guidance||campaign?.aiPlan?.days.find(p=>p.dayNumber===d.dayNumber);
  const controls=(d:Day)=><TaskControls key={d.id+':'+d.mission+':'+d.objective+':'+d.phase} day={d} days={campaign!.days} preparation={campaign!.preparationTasks||[]} changed={reloadCampaign}/>;
  const todayKey = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const day = campaign?.days.find(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.date))===todayKey);
  const allTasks = campaign?.days.flatMap(d=>d.tasks) || [];
  const progress = allTasks.length ? Math.round(100*allTasks.filter(t=>t.status==='DONE').length/allTasks.length) : 0;
  function change<K extends keyof Draft>(key:K,value:Draft[K]) {setDraft(d=>({...d,[key]:value}));}
  let detailsError='';try{buildDetailedInput(draft.details);}catch(e){detailsError=(e as Error).message;}
  const valid = [
    draft.businessType.trim().length > 0, draft.campaignType.trim().length > 0,
    draft.name.trim().length >= 2 && draft.product.trim().length >= 2,
    true, draft.offer.kind.trim().length > 0, draft.salesPath.action.trim().length > 0,
    Number.isInteger(draft.duration) && draft.duration>=1 && draft.duration<=90 && (draft.target==='' || /^\d+$/.test(draft.target)), true
  ];
  const offerMissing=([['تخفیف دارم','regularPrice','قیمت معمول'],['تخفیف دارم','campaignPrice','قیمت کمپین'],['هدیه دارم','bonus','هدیه واقعی'],['مهلت واقعی دارم','deadline','مهلت واقعی'],['ظرفیت واقعی محدود دارم','capacity','ظرفیت واقعی'],['شرایط پرداخت دارم','paymentTerms','شرایط پرداخت']] as const).filter(([kind,key])=>draft.offer.kind.split('، ').includes(kind)&&!draft.offer[key]?.trim()).map(([, ,label])=>label);
  const stepErrors=[
    valid[0]?'':'نوع کسب‌وکار را انتخاب کن یا بنویس.',
    valid[1]?'':'هدف کمپین را انتخاب کن یا بنویس.',
    valid[2]?'':'نام کمپین و توضیح محصول هرکدام باید حداقل ۲ کاراکتر باشند.',
    detailsError,
    !valid[4]?'نوع پیشنهاد را مشخص کن.':offerMissing.length?'اطلاعات پیشنهاد را کامل کن: '+offerMissing.join('، '):'',
    valid[5]?'':'اقدام مخاطب را انتخاب کن یا بنویس.',
    !valid[6]?'مدت باید عدد صحیح بین ۱ تا ۹۰ و هدف عددی باید عدد صحیح نامنفی با ارقام انگلیسی یا خالی باشد.':draft.startDate&&!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)?'تاریخ شروع معتبر وارد کن.':'',
    ''
  ];
  function advance(){const invalid=step===7?stepErrors.findIndex(Boolean):stepErrors[step]?step:-1;if(invalid>=0){setStep(invalid);return;}if(step===7)void create();else setStep(step+1);}
  async function create() {
    if(saving || stepErrors.some(Boolean)) return;
    setSaving(true); setError('');
    try {
      const previousLearnings=campaigns.find(c=>c.id===learningSource&&c.status==='COMPLETED')?.completion?.learnings;
      const {details,creationKey,...base}=draft;
      const key=creationKey||crypto.randomUUID();if(!creationKey){setDraft(d=>({...d,creationKey:key}));localStorage.setItem(draftKey,JSON.stringify({...draft,creationKey:key}));}
      const result = await request<Campaign>('campaigns',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({...base,startDate:draft.startDate||undefined,...buildDetailedInput(details),previousLearnings,target:draft.target===''?undefined:Number(draft.target)})});
      setCampaigns(cs=>[result,...cs]); setSelected(result.id); setView('plan'); setWizard(false); setStep(0); setDraft(empty);setLearningSource(''); localStorage.removeItem(draftKey);
    } catch(e) {setError((e as Error).message);} finally {setSaving(false);}
  }
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
  const choices=(values:string[],value:string,onChange:(v:string)=>void)=><div className="choices">{values.map(v=><button type="button" className={value===v?'selected':''} key={v} onClick={()=>onChange(v)} aria-pressed={value===v}>{v}</button>)}</div>;
  const navItems=[['dashboard','خانه'],['campaigns','کمپین‌های من'],['audience','مخاطبان و فروش'],['reports','گزارش‌ها'],['settings','تنظیمات']];
  return <main className="shell"><aside><div className="brand"><div className="logo"><Sparkles size={19}/></div>کمپین‌منیجر</div><nav>{navItems.map(([key,label])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}</nav><div className="aside-help"><p>قدم بعدی‌ات را با هم پیدا می‌کنیم.</p></div></aside>
    <section className="content"><header><div><span className="eyebrow">{new Intl.DateTimeFormat('fa-IR',{dateStyle:'full',timeZone:'Asia/Tehran'}).format(new Date())}</span><h1>فضای کار کمپین‌های تو</h1></div><button className="primary" onClick={()=>{setWizard(true);setError('');}}><Plus size={18}/>کمپین جدید</button></header>
      <nav className="mobile-nav">{navItems.map(([key,label])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}</nav>
      {error&&!wizard&&<div role="alert" className="error">{error}<button onClick={()=>void load()}>تلاش دوباره</button></div>}
      {loading?<p role="status">در حال خواندن کمپین‌ها…</p>:!campaign?<div className="empty-state"><Sparkles/><h2>اولین کمپینت رو بساز</h2><p>محصول و هدفت را بگو تا فضای اجرای کمپینت آماده شود.</p><button className="primary" onClick={()=>setWizard(true)}>ساخت کمپین</button></div>:<>
        {view==='campaigns'?<><h2>کمپین‌های من</h2><div className="campaign-list">{campaigns.map(c=><button className="campaign-card" key={c.id} onClick={()=>{setSelected(c.id);setView('plan');}}><strong>{c.name}</strong><span>{fa(c.duration)} روز · {c.status==='DRAFT'?'پیش‌نویس':c.status==='COMPLETED'?'پایان‌یافته':c.status==='PAUSED'?'متوقف':'در حال اجرا'}</span><span>مشاهده برنامه ←</span></button>)}</div></>:view==='reports'?<><h2>گزارش‌ها</h2><p className="wizard-hint">نتایج کمپین انتخاب‌شده را در یک نمای ساده ببین.</p><CampaignReport id={campaign.id} name={campaign.name}/><CampaignAnalysis campaignId={campaign.id} days={campaign.days} hasResults={campaign.days.some(d=>!!d.result)} onApplied={reloadCampaign}/></>:view==='settings'?<section className="settings-panel"><h2>تنظیمات</h2><p>تنظیمات پیشرفته هر کمپین داخل همان کمپین نگه‌داری می‌شود تا مسیر کار کوتاه بماند.</p><details><summary>راهنمای شروع سریع</summary><p>از «کمپین جدید» شروع کن، هدف و مخاطب را وارد کن و در هر مرحله ذخیره و ادامه بده. پیشنهادهای هوش مصنوعی قبل از ثبت نهایی قابل ویرایش هستند.</p></details></section>:view==='audience'?<><h2>مخاطبان و فروش</h2><p className="wizard-hint">تعریف مخاطب، پیشنهاد و مسیر اقدام از همین‌جا و داخل کمپین انتخاب‌شده انجام می‌شود.</p><CampaignFacts value={campaign}/><SetupEditor key={'audience:'+campaign.id+campaign.updatedAt} campaign={campaign} changed={reloadCampaign}/></>:<>
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
          {(view==='plan'||view==='results')?<><h2>{view==='results'?'نتایج روزهای کمپین':'برنامه اجرا'}</h2><p className="wizard-hint">{campaign.status==='ACTIVE'?'برنامه تأییدشده تو برای اجرا آماده است.':'تا پیش از تأیید طرح، برنامه اولیه نمایش داده می‌شود.'}</p><div className="timeline">{campaign.days.map(d=><article className="day-card" key={d.id}><span className="eyebrow">روز {fa(d.dayNumber)} · {new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(d.date))} {d.id===day?.id?' · امروز':''}</span><h3>{d.phase} — {d.mission}</h3><p>{d.objective}</p>{view==='results'?resultForm(d):taskCards(d.tasks)}</article>)}</div></>:<><div className="section-title"><h2>امروز چه کار کنم؟</h2>{day&&<small>{fa(day.tasks.filter(t=>t.status==='DONE').length)} از {fa(day.tasks.length)} کار انجام شده</small>}</div>{day?<>{taskCards(day.tasks)}{resultForm(day)}</>:<p>امروز خارج از بازه این کمپین است. برنامه را ببین.</p>}</>}
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
    {wizard&&<div className="modal-backdrop"><section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title"><button className="close" aria-label="بستن و نگهداری پیش‌نویس" disabled={saving} onClick={()=>setWizard(false)}>×</button><span className="eyebrow">مرحله {fa(step+1)} از {fa(titles.length)}</span><h2 id="wizard-title">{titles[step]}</h2>
      <p className="wizard-hint">پیش‌نویس روی همین مرورگر نگهداری می‌شود؛ تا ثبت نهایی می‌توانی به مراحل قبل برگردی.</p>
      {step===0&&<div className="choices">{([['quick','سریع بساز'],['detailed','دقیق‌تر بساز']] as const).map(([mode,label])=><button type="button" key={mode} className={draft.details.mode===mode?'selected':''} aria-pressed={draft.details.mode===mode} onClick={()=>change('details',{...draft.details,mode})}>{label}</button>)}</div>}
      {step===0&&<>{choices(['آموزش / دوره','محصول فیزیکی','خدمات','مشاوره','نرم‌افزار / اشتراک','رویداد','B2B','سایر'],draft.businessType,v=>change('businessType',v))}<Field label="یا کسب‌وکارت را بنویس" value={draft.businessType} change={v=>change('businessType',v)}/></>}
      {step===1&&<>{choices(['فروش یک محصول','معرفی محصول جدید','فروش ویژه','جذب مشتری بالقوه','فروش به مشتری قبلی','معرفی و آگاهی','هنوز مطمئن نیستم'],draft.campaignType,v=>change('campaignType',v))}<Field label="هدف دیگری دارم" value={draft.campaignType} change={v=>change('campaignType',v)}/></>}
      {step===2&&<><Field label="نام کمپین" value={draft.name} change={v=>change('name',v)}/><Field label="نام محصول و کاری که برای مشتری انجام می‌دهد" value={draft.product} change={v=>change('product',v)} multiline/></>}
      {step===3&&<><Field label="چه کسانی معمولاً می‌خرند؟ (اختیاری)" value={draft.audience} change={v=>change('audience',v)} multiline/><Field label="مهم‌ترین مشکلشان چیست؟ (اختیاری)" value={draft.problem} change={v=>change('problem',v)}/><Field label="دوست دارند به چه نتیجه‌ای برسند؟ (اختیاری)" value={draft.outcome} change={v=>change('outcome',v)}/><button className="text-button" disabled={!!stepErrors[3]} onClick={()=>{change('audience','نمی‌دانم');setStep(4);}}>نمی‌دانم — فعلاً ادامه بده</button></>}
      {step===3&&draft.details.mode==='detailed'&&<PlanningDetailsForm value={draft.details} onChange={v=>change('details',v)}/>}
      {step===3&&<ContextHelp input={{businessType:draft.businessType,campaignType:draft.campaignType,product:draft.product,audience:draft.audience,problem:draft.problem,outcome:draft.outcome,salesPath:draft.salesPath.action}} apply={(field,value)=>change(field,value)}/>}
      {step===4&&<><div className="choices">{['پیشنهاد خاصی ندارم','تخفیف دارم','هدیه دارم','مهلت واقعی دارم','ظرفیت واقعی محدود دارم','شرایط پرداخت دارم','سایر'].map(kind=><button key={kind} type="button" aria-pressed={draft.offer.kind.split('، ').includes(kind)} className={draft.offer.kind.split('، ').includes(kind)?'selected':''} onClick={()=>{const kinds=draft.offer.kind.split('، ').filter(k=>k!=='پیشنهاد خاصی ندارم');const next=kind==='پیشنهاد خاصی ندارم'?[]:kinds.includes(kind)?kinds.filter(k=>k!==kind):[...kinds,kind];const offer={...draft.offer,kind:next.join('، ')||'پیشنهاد خاصی ندارم'};if(!next.includes('تخفیف دارم')){delete offer.regularPrice;delete offer.campaignPrice;}if(!next.includes('هدیه دارم'))delete offer.bonus;if(!next.includes('مهلت واقعی دارم'))delete offer.deadline;if(!next.includes('ظرفیت واقعی محدود دارم'))delete offer.capacity;if(!next.includes('شرایط پرداخت دارم'))delete offer.paymentTerms;change('offer',offer);}}>{kind}</button>)}</div>{draft.offer.kind.includes('تخفیف دارم')&&<><Field label="قیمت معمول واقعی (تومان)" value={draft.offer.regularPrice||''} change={v=>change('offer',{...draft.offer,regularPrice:v})}/><Field label="قیمت واقعی این کمپین (تومان)" value={draft.offer.campaignPrice||''} change={v=>change('offer',{...draft.offer,campaignPrice:v})}/></>}{([['هدیه دارم','bonus','هدیه واقعی'],['مهلت واقعی دارم','deadline','مهلت واقعی با تاریخ'],['ظرفیت واقعی محدود دارم','capacity','ظرفیت واقعی'],['شرایط پرداخت دارم','paymentTerms','شرایط پرداخت']] as const).map(([kind,key,label])=>draft.offer.kind.includes(kind)?<Field key={key} label={label} value={draft.offer[key]||''} change={v=>change('offer',{...draft.offer,[key]:v})}/>:null)}{draft.offer.kind!=='پیشنهاد خاصی ندارم'&&<Field label="جزئیات دیگر واقعی پیشنهاد" value={draft.offer.details} change={v=>change('offer',{...draft.offer,details:v})} multiline/>}</>}
      {step===5&&<>{choices(['پیام به پشتیبانی','خرید از سایت','لینک پرداخت','فرم ثبت‌نام','تماس تلفنی','رزرو مشاوره','سایر'],draft.salesPath.action,v=>change('salesPath',{...draft.salesPath,action:v}))}<Field label="اقدام مخاطب" value={draft.salesPath.action} change={v=>change('salesPath',{...draft.salesPath,action:v})}/><Field label="بعد از آن چه اتفاقی می‌افتد؟ یا نشانی / راه تماس" value={draft.salesPath.details} change={v=>change('salesPath',{...draft.salesPath,details:v})} multiline/></>}
      {step===6&&<><label className="field">مدت کمپین (۱ تا ۹۰ روز)<input type="number" min={1} max={90} value={draft.duration} onChange={e=>change('duration',Number(e.target.value))}/></label><Field label="هدف عددی (اختیاری؛ بدون هدف عددی خالی بگذار)" value={draft.target} change={v=>change('target',v)}/></>}
      {step===6&&<label className="field">واقعاً چند محتوا در روز می‌توانی منتشر کنی؟<select value={draft.details.maxContentPerDay} onChange={e=>change('details',{...draft.details,maxContentPerDay:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{fa(n)} محتوا</option>)}</select><small>این سقف است، نه تعداد اجباری انتشار روزانه.</small></label>}
      {step===6&&<><div className="choices">{[5,7,10,14].map(n=><button key={n} type="button" className={draft.duration===n?'selected':''} onClick={()=>change('duration',n)}>{fa(n)} روز</button>)}</div><label className="field">تاریخ شروع دلخواه (اختیاری)<input type="date" value={draft.startDate||''} onChange={e=>change('startDate',e.target.value)}/><small>خالی یعنی شروع در زمان تأیید طرح. تاریخ انتخاب‌شده بدون حدس تغییر داده نمی‌شود.</small></label></>}
      {step===7&&<section><h3>بررسی آمادگی</h3><p>سقف روزانه: {fa(draft.details.maxContentPerDay)} محتوا</p>{draft.duration>14&&<p role="alert">ثبت کمپین ممکن است، اما ساخت طرح هوشمند فعلاً فقط تا ۱۴ روز فعال است. برای طرح هوشمند، مدت را در مرحله قبل اصلاح کن.</p>}{!draft.audience.trim()&&<p>مخاطب هنوز مشخص نیست؛ مدل باید این محدودیت را در فرض‌ها بیان کند.</p>}{!draft.salesPath.details.trim()&&<p>جزئیات مسیر خرید خالی است؛ لینک یا نشانی واقعی را هنگام انتشار خودت وارد کن.</p>}{draft.details.mode==='detailed'&&<><p>تردیدها: {draft.details.objectionsStatus==='known'?draft.details.objections:draft.details.objectionsStatus==='none'?'هیچ مورد شناخته‌شده‌ای ندارم':'نامعلوم'}</p><p>شواهد: {draft.details.proofStatus==='known'?draft.details.proofs.map(p=>p.type+' — '+p.description+(p.count?' — تعداد: '+p.count:'')).join('؛ '):draft.details.proofStatus==='none'?'هیچ شاهدی ندارم':'نامعلوم'}</p><p>قالب‌های قابل اجرا: {draft.details.formatsStatus==='known'?draft.details.formats.join('، '):draft.details.formatsStatus==='none'?'فعلاً هیچ قالبی قابل اجرا نیست':'نامعلوم'}</p>{draft.details.formatsStatus==='none'&&<p>قبل از اجرا باید برای تهیه محتوا راهی پیدا کنی؛ این وضعیت به برنامه‌ریز منتقل می‌شود.</p>}</>}{detailsError&&<p className="error" role="alert">{detailsError} برای اصلاح به مرحله مخاطب برگرد.</p>}</section>}
      {step===7&&<div className="review"><p><strong>{draft.name}</strong></p><p>{draft.businessType} · {draft.campaignType}</p><p>{draft.product}</p><p>مخاطب: {draft.audience||'هنوز مشخص نیست'}</p><p>پیشنهاد: {draft.offer.kind} {draft.offer.details}</p><p>مسیر اقدام: {draft.salesPath.action} — {draft.salesPath.details}</p><p>{fa(draft.duration)} روز · هدف: {draft.target||'بدون هدف عددی'}</p><p className="wizard-hint">با ثبت، اطلاعات کمپین در دیتابیس ذخیره می‌شود؛ سپس طرح را می‌سازی و تأیید می‌کنی. هنوز درخواست هوش مصنوعی ارسال نمی‌شود.</p></div>}
      {step===7&&<label className="field">استفاده اختیاری از آموخته‌های کمپین قبلی<select value={learningSource} disabled={saving} onChange={e=>setLearningSource(e.target.value)}><option value="">بدون انتقال آموخته‌ها</option>{campaigns.filter(c=>c.status==='COMPLETED'&&c.completion?.learnings.length).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{campaigns.find(c=>c.id===learningSource)?.completion?.learnings.map((s,i)=><small key={i}>{s}</small>)}<small>فقط برای کمپین مرتبط انتخاب کن؛ این نکته‌ها تضمین نتیجه نیستند.</small></label>}
      {error&&<p className="error" role="alert">{error}</p>}
      {stepErrors[step]&&<p id="step-error" className="error" role="alert">{stepErrors[step]}</p>}
      {step===7&&stepErrors.some(Boolean)&&<p className="error" role="alert">اطلاعات مرحله‌های قبلی ناقص است. با دکمه زیر به اولین مورد برگرد.</p>}
      <div className="wizard-actions"><button className="primary" aria-describedby={stepErrors[step]?'step-error':undefined} disabled={saving||!!stepErrors[step]} onClick={advance}>{saving?'در حال ذخیره…':step===7?(stepErrors.some(Boolean)?'اصلاح اطلاعات ناقص':'ثبت کمپین'):'ادامه'}</button>{step>0&&<button className="outline" disabled={saving} onClick={()=>setStep(step-1)}>بازگشت</button>}</div>
    </section></div>}
  </main>;
}

'use client';
import GuideEducation,{GuideBrowser} from './campaign-guide-education';
import CampaignJourney,{defaultCampaignStage,type CampaignStage} from './campaign-journey';
import DailyNextAction from './daily-next-action';
import {campaignNext,nextDailyWork} from './execution-next';
import DailyTaskList from './daily-task-list';
import CampaignMethod from './campaign-method';
import DisclosureSummary from './disclosure-summary';
import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, FolderKanban, LayoutDashboard, Plus, BookOpen, Sparkles, CopyPlus } from 'lucide-react';
import PlanReview from './plan-review';
import ContentEditor from './content-editor';
import { ContentPreview } from './rich-content-editor';
import { request } from './api';
import DailyResults from './daily-results';
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
import ResultsSummary from './results-summary';
import SimpleCampaignWizard from './campaign-wizard';
import AuthScreen from './auth-screen';
import CampaignManagement from './campaign-management';
import GettingStarted from './getting-started';
import CampaignReuse from './campaign-reuse';
import type { Task, Day, Campaign } from './campaign-types';
import DashboardToday from './dashboard-today';
import WorkspaceHeader from './workspace-header';
import DayPicker from './day-picker';
const fa = (n: number) => n.toLocaleString('fa-IR');

function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState('');
  const [selectedDay,setSelectedDay]=useState('');
  const [contentTaskId,setContentTaskId]=useState('');
  const [focusedTask,setFocusedTask]=useState('');
  const [contentSettingsTarget,setContentSettingsTarget]=useState<HTMLDivElement|null>(null);
  const [view, setView] = useState('dashboard');
  const [stageSelections,setStageSelections]=useState<Record<string,CampaignStage>>({});
  const [reuseCampaign,setReuseCampaign]=useState<Campaign|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [createReturnView,setCreateReturnView]=useState('dashboard');
  const wizard=view==='create';
  function openWizard(){if(view!=='create')setCreateReturnView(view);setView('create');setError('');}
  const [planning, setPlanning] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setCampaigns(await request<Campaign[]>('campaigns')); } catch(e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); }, []);
  const campaign = campaigns.find(c=>c.id===selected) || campaigns[0];
  const stage=campaign?(stageSelections[campaign.id]??defaultCampaignStage(campaign)):'info';
  function chooseStage(next:CampaignStage){if(!campaign)return;setStageSelections(current=>({...current,[campaign.id]:next}));setView(next==='info'?'audience':next==='results'||next==='completion'?'results':'plan');}
  function changeView(next:string){if(next==='audience')chooseStage('info');else if(next==='results')chooseStage(campaign?.status==='COMPLETED'?'completion':'results');else if(next==='plan')chooseStage(campaign?defaultCampaignStage(campaign):'info');else{setView(next);if(campaign)setStageSelections(current=>({...current,[campaign.id]:'execution'}));}}
  function openCampaign(c:Campaign){setSelected(c.id);setSelectedDay('');setContentTaskId('');const next=defaultCampaignStage(c);setStageSelections(current=>({...current,[c.id]:next}));setView(next==='completion'?'results':'plan');}
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('campaign-workspace-v3')||'null');if(saved){setSelected(saved.id);setSelectedDay(saved.day||'');setContentTaskId(saved.task||'');if(['info','method','plan','preparation','execution','results','completion'].includes(saved.stage))setStageSelections({[saved.id]:saved.stage});if(['plan','today','results','audience'].includes(saved.view))setView(saved.view);}}catch{}},[]);
  useEffect(()=>{if(loading||!campaign||!['plan','today','results','audience'].includes(view))return;try{localStorage.setItem('campaign-workspace-v3',JSON.stringify({id:campaign.id,stage,view,day:selectedDay,task:contentTaskId}));}catch{}},[loading,campaign,stage,view,selectedDay,contentTaskId]);

  useEffect(()=>{if(!loading&&!campaign&&view!=='dashboard'&&view!=='guide'&&view!=='learn'&&view!=='create')setView('dashboard');}, [campaign,loading,view]);
  async function reloadCampaign(){if(!campaign)return;const result=await request<Campaign>('campaigns/'+campaign.id);setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));}
  const guidance=(d:Day)=>d.guidance||campaign?.aiPlan?.days.find(p=>p.dayNumber===d.dayNumber);
  const controls=(d:Day)=><TaskControls key={d.id+':'+d.mission+':'+d.objective+':'+d.phase} day={d} days={campaign!.days} preparation={campaign!.preparationTasks||[]} changed={reloadCampaign}/>;
  const todayKey = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const day = campaign?.days.find(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.date))===todayKey);
  const workDay=campaign?.days.find(d=>d.id===selectedDay)||day||campaign?.days[0];
  const contentTasks=workDay?.tasks.filter(t=>t.type==='CONTENT'&&!t.archived)||[];
  const contentTask=contentTasks.find(t=>t.id===contentTaskId)||contentTasks.find(t=>t.status==='PENDING')||contentTasks[0];
  function saveContent(id:string,content:string){setCampaigns(cs=>cs.map(c=>({...c,days:c.days.map(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,content}:t)}))})));void reloadCampaign().catch(e=>setError((e as Error).message));}
  const allTasks = campaign?.days.flatMap(d=>d.tasks).filter(t=>!t.archived) || [];
  const progress = allTasks.length ? Math.round(100*allTasks.filter(t=>t.status==='DONE').length/allTasks.length) : 0;
  async function complete(task:Task) {
    if(pending || task.status!=='PENDING' || !campaigns.some(c=>c.status==='ACTIVE'&&c.days.some(d=>d.tasks.some(t=>t.id===task.id&&!t.archived)))) return;
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
      setCampaigns(cs=>cs.map(c=>c.id===result.id?result:c));if(action==='approve')chooseStage('preparation');
    } catch(e) {setError((e as Error).message);} finally {setPlanning(false);}
  }
  const resultForm=(d:Day)=><DailyResults key={d.id} dayId={d.id} result={d.result} future={new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.date))>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())} onSaved={result=>setCampaigns(cs=>cs.map(c=>({...c,days:c.days.map(day=>day.id===d.id?{...day,result}:day)})))}/>;
  const taskCards=(tasks:Task[])=><DailyTaskList focusedTask={focusedTask} tasks={tasks} campaign={campaign!} pending={pending} complete={task=>void complete(task)} content={task=>{setContentTaskId(task.id);setView('today');}}/>;
  const navIcons: Record<string, typeof LayoutDashboard> = {dashboard:LayoutDashboard,campaigns:FolderKanban,reports:BarChart3,guide:BookOpen,learn:BookOpen};
  const navItems=[['dashboard','داشبورد'],['campaigns','کمپین‌های من'],['reports','گزارش‌ها'],['learn','آشنایی با کمپین‌ها'],['guide','راهنما']];
  return <main className="shell"><aside><div className="brand"><div className="logo"><Sparkles size={19}/></div>کمپین‌منیجر</div><nav>{navItems.map(([key,label])=>{const Icon=navIcons[key];return <button key={key} className={view===key||(['plan','today','results','audience'].includes(view)&&key==='campaigns')?'active':''} onClick={()=>setView(key)}><Icon size={18}/>{label}<ChevronLeft size={14} className="nav-chevron"/></button>;})}</nav><button className="primary sidebar-create" onClick={()=>{openWizard();setError('');}}><Plus size={18}/>کمپین جدید</button><div className="aside-help"><Sparkles size={20}/><p>قدم بعدی‌ات را با هم پیدا می‌کنیم.</p></div></aside>
    <section className="content"><header><div><span className="eyebrow">{new Intl.DateTimeFormat('fa-IR',{dateStyle:'full',timeZone:'Asia/Tehran'}).format(new Date())}</span><h1>فضای کار کمپین‌های تو</h1></div><button className="primary" onClick={()=>{openWizard();setError('');}}><Plus size={18}/>کمپین جدید</button></header>

      <nav className="mobile-nav">{navItems.map(([key,label])=><button data-nav={key} key={key} className={view===key?'active':''} onClick={()=>setView(key)}>{label}</button>)}</nav>
      {error&&!wizard&&<div role="alert" className="error">{error}<button onClick={()=>void load()}>تلاش دوباره</button></div>}
      {view==='create'?<SimpleCampaignWizard<Campaign> previousCampaigns={campaigns} onClose={()=>setView(createReturnView)} onCreated={result=>{setCampaigns(cs=>[result,...cs]);setSelected(result.id);setSelectedDay('');setView('plan');}}/>:view==='learn'?<GuideBrowser/>:view==='guide'?<GettingStarted hasCampaign={!!campaign} onCreate={()=>{openWizard();setError('');}} onCampaigns={()=>setView('campaigns')}/>:loading?<p role="status">در حال خواندن کمپین‌ها…</p>:!campaign?<div className="empty-state"><Sparkles/><h2>اولین کمپینت رو بساز</h2><p>محصول و هدفت را بگو تا فضای اجرای کمپینت آماده شود.</p><button className="primary" onClick={()=>openWizard()}>ساخت اولین کمپین</button></div>:<>
        {view==='dashboard'?<DashboardToday campaigns={campaigns} pending={pending} complete={task=>void complete(task)} open={(c,d,task)=>{setSelected(c.id);setSelectedDay(d?.id||'');setContentTaskId(task?.id||'');const suggested=campaignNext(c);const work=d?nextDailyWork(c,d):null;const next=c.status==='ACTIVE'&&!task&&work?.missing.length?'preparation':c.status==='ACTIVE'&&d&&!work?.task?'results':defaultCampaignStage(c);if(!task&&work?.task&&!work.missing.length)setFocusedTask(work.task.id);setStageSelections(current=>({...current,[c.id]:next}));setView(task?.type==='CONTENT'?'today':next==='completion'||next==='results'?'results':'plan');if(!d&&suggested.day)setSelectedDay(suggested.day.id);}} browse={()=>setView('campaigns')}/>:view==='campaigns'?<><h2>کمپین‌های من</h2><div className="campaign-list">{campaigns.map(c=><article className="campaign-list-entry" key={c.id}><button className="campaign-card" onClick={()=>{openCampaign(c);}}><strong>{c.name}</strong><span>{fa(c.duration)} روز · {c.status==='DRAFT'?'پیش‌نویس':c.status==='COMPLETED'?'پایان‌یافته':c.status==='PAUSED'?'متوقف':'در حال اجرا'}</span><span>مشاهده برنامه ←</span></button><div className="campaign-card-actions"><button type="button" className="outline campaign-reuse-action" aria-label={'استفاده مجدد از '+c.name} onClick={()=>setReuseCampaign(c)}><CopyPlus size={16}/>استفاده مجدد</button><CampaignManagement compact campaign={c} changed={reloadCampaign} removed={id=>{setCampaigns(cs=>cs.filter(item=>item.id!==id));if(selected===id){setSelected('');setSelectedDay('');setContentTaskId('');}}}/></div></article>)}</div></>:view==='reports'?<><h2>گزارش‌ها</h2><p className="wizard-hint">نتایج کمپین انتخاب‌شده را در یک نمای ساده ببین.</p><label className="field">کمپین گزارش<select value={campaign.id} onChange={e=>setSelected(e.target.value)}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><ResultsSummary days={campaign.days}/><CampaignReport id={campaign.id} name={campaign.name}/><CampaignAnalysis campaignId={campaign.id} days={campaign.days} hasResults={campaign.days.some(d=>!!d.result)} onApplied={reloadCampaign}/></>:<>
          <label className="field campaign-picker">کمپین انتخاب‌شده<select disabled={planning} value={campaign.id} onChange={e=>{const next=campaigns.find(c=>c.id===e.target.value);if(next)openCampaign(next);}}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <WorkspaceHeader campaign={campaign} view={view} progress={progress} change={changeView}/><CampaignJourney campaign={campaign} stage={stage} select={chooseStage}/>
          <section id="workspace-panel" role="tabpanel" aria-labelledby={'workspace-tab-'+view} tabIndex={0}>
          {view==='audience'?<>
            <details className="day-card"><DisclosureSummary icon="document">استفاده دوباره از این کمپین</DisclosureSummary><h2>استفاده دوباره از این کمپین</h2><p className="wizard-hint">از اطلاعات یا طرح قبلی، یک پیش‌نویس جدید برای اجرای تازه بساز.</p><button type="button" className="outline" onClick={()=>setReuseCampaign(campaign)}><CopyPlus size={16}/>استفاده مجدد از کمپین</button></details>
            <section className="day-card"><h3>{campaign.name}</h3><p>{campaign.product}</p><p>هدف: {campaign.campaignType||'در اطلاعات ثبت شده است'}</p><button className="primary" onClick={()=>{const editor=document.querySelector<HTMLDetailsElement>('.setup-editor');if(editor){editor.open=true;editor.scrollIntoView({block:'start'});editor.querySelector<HTMLInputElement>('input')?.focus();}}}>ویرایش اطلاعات کسب‌وکار</button>{campaign.status==='DRAFT'&&<button className="outline" onClick={()=>chooseStage(campaign.planningContext?.methodRequired&&!campaign.aiPlan?'method':'plan')}>ادامه مسیر کمپین</button>}</section>
            <CampaignFacts value={campaign}/>
            <SetupEditor key={campaign.id+campaign.updatedAt} campaign={campaign} changed={async value=>{if(value&&value.id!==campaign.id){const result=await request<Campaign>('campaigns/'+value.id);setCampaigns(cs=>[result,...cs.filter(c=>c.id!==result.id)]);setSelected(result.id);setSelectedDay('');setView('plan');}else await reloadCampaign();}}/>
            <CampaignManagement key={'manage:'+campaign.id+campaign.updatedAt} campaign={campaign} changed={reloadCampaign} removed={id=>{setCampaigns(cs=>cs.filter(c=>c.id!==id));setSelected('');setContentTaskId('');setView('campaigns');}}/>
            <CampaignHistory key={'history:'+campaign.id} id={campaign.id}/>
          </>:view==='plan'?<>
            {campaign.status==='DRAFT'?<>
              {stage==='method'?<><CampaignMethod key={campaign.id} id={campaign.id} hasPlan={!!campaign.aiPlan} changed={reloadCampaign} edit={()=>chooseStage('info')}/>{(campaign.methodReady??campaign.planningContext?.methodState?.accepted)&&<button className="primary" onClick={()=>chooseStage('plan')}>ادامه به بررسی طرح</button>}</>:<><PlanReview plan={campaign.aiPlan} goal={campaign.campaignType} method={campaign.planningContext?.methodState?.accepted?.title} status={campaign.status} duration={campaign.duration} busy={planning} action={v=>void planAction(v)}/>{campaign.aiPlan&&<PlanEditor key={campaign.id+JSON.stringify(campaign.aiPlan)} id={campaign.id} plan={campaign.aiPlan} changed={reloadCampaign}/>}</>}
            </>:stage==='preparation'?<><PreparationChecklist key={'preparation:'+campaign.id} id={campaign.id} status={campaign.status} days={campaign.days} planned={campaign.aiPlan?.preparation||[]} changed={reloadCampaign}/><button className="primary" onClick={()=>chooseStage('execution')}>رفتن به اجرای روزانه</button></>:stage==='plan'?<PlanReview plan={campaign.aiPlan} goal={campaign.campaignType} method={campaign.planningContext?.methodState?.accepted?.title} status={campaign.status} duration={campaign.duration} busy={planning} action={v=>void planAction(v)}/>:<>
              <DayPicker days={campaign.days} value={workDay?.id||''} change={setSelectedDay} cards/>
              {campaign.status==='PAUSED'&&<p role="status">کمپین متوقف است؛ برنامه و محتوا برای مشاهده در دسترس‌اند.</p>}
              {workDay?<div className="daily-workspace"><section className="day-card day-mission"><span className="eyebrow">روز {fa(workDay.dayNumber)} · {new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium'}).format(new Date(workDay.date))}</span><h2>امروز چه کار کنم؟</h2><p>{workDay.mission}</p><p className="wizard-hint">{fa(workDay.tasks.filter(t=>!t.archived&&t.status==='DONE').length)} از {fa(workDay.tasks.filter(t=>!t.archived).length)} کار انجام شده</p>
              {campaign.preparationTasks?.some(p=>!p.completed&&((p.requiredBeforeDay??Infinity)<=workDay.dayNumber||workDay.tasks.some(t=>t.preparationIds?.includes(p.id))))&&<div className="preparation-warning"><p>بعضی پیش‌نیازهای ضروری این روز آماده نشده‌اند.</p><button className="outline" onClick={()=>chooseStage('preparation')}>بررسی آماده‌سازی</button></div>}
              <DailyNextAction campaign={campaign} day={workDay} prepare={()=>chooseStage('preparation')} results={()=>chooseStage('results')} start={task=>{setFocusedTask(task.id);requestAnimationFrame(()=>{const target=document.getElementById('daily-task-'+task.id);if(target){const details=target.querySelector('details');if(details)details.open=true;target.scrollIntoView({block:'center',behavior:'auto'});target.querySelector<HTMLElement>('summary')?.focus();}});}}/><details><DisclosureSummary icon="document">مشاهده راهنمای این روز</DisclosureSummary><MissionGuidance value={guidance(workDay)} objective={workDay.objective} analyze={()=>chooseStage('results')}/></details>{campaign.status==='ACTIVE'&&controls(workDay)}</section><section className="day-card day-tasks"><h2>کارهای روز {fa(workDay.dayNumber)}</h2>{taskCards(workDay.tasks)}<button className="primary" onClick={()=>chooseStage('results')}>ثبت نتیجه این روز</button></section></div>:<section className="day-card"><p>روزی برای این کمپین ثبت نشده است.</p></section>}
            </>}
          </>:view==='today'?<><button className="outline" onClick={()=>chooseStage('execution')}>بازگشت به کارهای روز</button>
            {campaign.status==='DRAFT'?<section className="day-card"><h2>محتوا پس از تأیید طرح</h2><p>ابتدا طرح را در بخش برنامه بررسی و تأیید کن.</p><button className="primary" onClick={()=>setView('plan')}>بررسی برنامه</button></section>:<div className="content-workspace"><section className="day-card content-selection"><h2>انتخاب روز و کار</h2><DayPicker days={campaign.days} value={workDay?.id||''} change={id=>{setSelectedDay(id);setContentTaskId('');}}/><label className="field">کار محتوایی<select value={contentTask?.id||''} onChange={e=>setContentTaskId(e.target.value)}>{!contentTasks.length&&<option value="">این روز کار محتوایی ندارد</option>}{contentTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><div ref={setContentSettingsTarget}/>{contentTask&&<><span className="tag blue">{contentTask.format||'محتوا'}</span><h3>{contentTask.title}</h3><details><DisclosureSummary icon="document">راهنمای کار محتوایی</DisclosureSummary>{contentTask.objective&&<p>هدف: {contentTask.objective}</p>}<p>{contentTask.why}</p>{campaign.planningContext?.methodState?.accepted?.id&&<GuideEducation ids={[contentTask.metadata?.guideRef?.methodId||campaign.planningContext.methodState.accepted.id]} stageIndex={contentTask.metadata?.guideRef?.stageIndex}/ >}</details>{contentTask.cta&&<p>اقدام مخاطب: {contentTask.cta}</p>}{contentTask.preparationIds?.map(id=>{const p=campaign.preparationTasks.find(p=>p.id===id);return p?<p className={p.completed?'wizard-hint':'error'} key={id}>پیش‌نیاز: {p.title} · {p.completed?'آماده':'آماده نشده'}</p>:null;})}<p className="wizard-hint">متن را بررسی و خودت منتشر کن؛ سپس انجام کار را ثبت کن.</p><button className="outline" disabled={!!pending||campaign.status!=='ACTIVE'||contentTask.status!=='PENDING'} onClick={()=>void complete(contentTask)}>{contentTask.status==='DONE'?'انجام شد':contentTask.status==='SKIPPED'?'ردشده':pending===contentTask.id?'در حال ثبت…':'انجام دادم'}</button></>}</section><section className="content-writing">{contentTask?(campaign.status==='ACTIVE'&&contentTask.status==='PENDING'&&!contentTask.locked?<ContentEditor inline onComplete={()=>void complete(contentTask)} completing={pending===contentTask.id} settingsTarget={contentSettingsTarget} key={contentTask.id} task={contentTask} onClose={()=>{}} onSaved={saveContent}/>:<article className="day-card"><h2>محتوای محفوظ</h2><p className="wizard-hint">{contentTask.locked?'این کار قفل است.':'این کار در وضعیت فقط مشاهده است.'}</p><ContentPreview value={contentTask.content||'متنی برای این کار ذخیره نشده است.'}/>{contentTask.content&&<button className="outline" onClick={()=>void navigator.clipboard.writeText(contentTask.content||'')}>کپی</button>}</article>):<article className="day-card"><h2>محتوای روز</h2><p>برای این روز کار محتوایی ثبت نشده است. می‌توانی روز دیگری را انتخاب کنی.</p></article>}</section></div>}
          </>:view==='results'?<>
            {campaign.status==='DRAFT'?<section className="day-card"><h2>نتایج پس از شروع اجرا</h2><p>پس از تأیید طرح و اجرای کارها، نتیجه واقعی هر روز را اینجا ثبت کن.</p><button className="outline" onClick={()=>setView('plan')}>بررسی برنامه</button></section>:<>{stage!=='completion'&&<><div className="results-workspace"><ResultsSummary days={campaign.days}/><section className="results-entry"><DayPicker days={campaign.days} value={workDay?.id||''} change={setSelectedDay}/>{workDay&&(campaign.status==='ACTIVE'?resultForm(workDay):<section className="day-card"><h2>نتیجه روز {fa(workDay.dayNumber)} · فقط مشاهده</h2>{workDay.result?<><p>ارزیابی: {({WEAK:'ضعیف',NORMAL:'معمولی',GOOD:'خوب',GREAT:'خیلی خوب'} as Record<string,string>)[workDay.result.rating]||workDay.result.rating}</p>{([['views','بازدید'],['leads','سرنخ'],['warmLeads','علاقه‌مندان'],['sales','فروش'],['revenue','درآمد (تومان)']] as const).map(([key,label])=><p key={key}>{label}: {workDay.result?.[key]==null?'نامعلوم':Number(workDay.result[key]).toLocaleString('fa-IR')}</p>)}<p>{workDay.result.feedback}</p><p>{workDay.result.notes}</p></>:<p>نتیجه‌ای برای این روز ثبت نشده است.</p>}</section>)}</section></div>{campaign.status==='ACTIVE'&&<CampaignAnalysis key={'analysis:'+campaign.id} campaignId={campaign.id} days={campaign.days} hasResults={campaign.days.some(d=>!!d.result)} onApplied={reloadCampaign}/>}</>}{stage==='completion'&&(campaign.status==='ACTIVE'||campaign.status==='COMPLETED')&&<CampaignCompletion key={'completion:'+campaign.id} id={campaign.id} completed={campaign.status==='COMPLETED'} onCompleted={reloadCampaign}/>}</>}
            {stage==='completion'&&campaign.status==='COMPLETED'&&<CampaignLearning key={'learning:'+campaign.id} id={campaign.id} confirmed={reloadCampaign}/>}
            <CampaignReport id={campaign.id} name={campaign.name}/>
          </>:null}
          </section>

        </>}
      </>}
    </section>

    <button className="logout-button" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'include'});window.location.reload();}}>خروج از حساب</button>
    {reuseCampaign&&<CampaignReuse key={reuseCampaign.id} campaign={reuseCampaign} onClose={()=>setReuseCampaign(null)} onCreated={result=>{setCampaigns(cs=>[result,...cs.filter(c=>c.id!==result.id)]);setSelected(result.id);setSelectedDay('');setContentTaskId('');setView('plan');setReuseCampaign(null);}}/>}

  </main>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }).then(response => setAuthenticated(response.ok)).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <main className="shell"><section className="content" style={{maxWidth:520,margin:'20vh auto'}}><p>در حال بررسی نشست…</p></section></main>;
  return authenticated ? <Dashboard /> : <AuthScreen onSuccess={() => setAuthenticated(true)} />;
}

import type {Campaign,Day} from './campaign-types';
export const tehranDay=(date:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function nextDailyWork(c:Campaign,d:Day){
 const tasks=d.tasks.filter(t=>!t.archived).sort((a,b)=>a.position-b.position);
 const task=tasks.find(t=>t.status==='PENDING');
 const missing=(c.preparationTasks||[]).filter(p=>!p.completed&&((p.requiredBeforeDay??Infinity)<=d.dayNumber||task?.preparationIds?.includes(p.id)));
 return {tasks,task,missing,done:tasks.filter(t=>t.status==='DONE').length};
}
export function campaignNext(c:Campaign){
 if(c.status==='DRAFT')return {title:c.planningContext?.methodRequired&&!(c.methodReady??c.planningContext.methodState?.accepted)&&!c.aiPlan?'روش مناسب را انتخاب کن':c.aiPlan?'طرح را بررسی و تأیید کن':'طرح کمپین را بساز',day:undefined};
 if(c.status==='COMPLETED')return {title:'جمع‌بندی و آموخته‌ها را مرور کن',day:undefined};
 if(c.status==='PAUSED')return {title:'برنامه کمپین متوقف‌شده را مرور کن',day:undefined};
 const today=tehranDay(new Date().toISOString());
 const days=[...c.days].sort((a,b)=>a.dayNumber-b.dayNumber);
 const day=days.find(d=>tehranDay(d.date)===today)||days.find(d=>tehranDay(d.date)<today&&d.tasks.some(t=>!t.archived&&t.status==='PENDING'))||days.find(d=>tehranDay(d.date)>today)||days.at(-1);
 if(!day)return {title:'برنامه روزهای کمپین را بررسی کن',day};
 const work=nextDailyWork(c,day);
 return {title:work.missing.length?'پیش‌نیازهای روز را آماده کن':work.task?'شروع کار بعدی':!day.result?'نتیجه این روز را ثبت کن':'نتایج و قدم بعدی را مرور کن',day};
}

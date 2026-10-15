import ExcelJS from 'exceljs';

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const items = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const records = (value: unknown) => items(value).map(object);
const cell = (value: unknown): string | number | boolean | null => value == null ? null :
  typeof value === 'number' || typeof value === 'boolean' ? value :
  typeof value === 'string' ? value : JSON.stringify(value);
const labels: Record<string, string> = {
  DRAFT:'پیش‌نویس', ACTIVE:'در حال اجرا', COMPLETED:'پایان‌یافته', PAUSED:'متوقف',
  PENDING:'در برنامه', DONE:'انجام‌شده', SKIPPED:'ردشده',
  CONTENT:'محتوا', OPERATIONAL:'عملیاتی', SALES:'فروش', SUPPORT:'پشتیبانی',
  PREPARATION:'آماده‌سازی', FOLLOW_UP:'پیگیری', MEASUREMENT:'اندازه‌گیری',
};
const label = (value: unknown) => labels[String(value)] || cell(value);
const metric = (value: unknown) => typeof value === 'string' && /^-?\d{1,15}$/.test(value) ? Number(value) : value;
const date = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('fa-IR', {
    timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short',
  }).format(parsed);
};

export async function createReportWorkbook(campaign: Data, preview: Data, history: unknown, exportedAt = new Date()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'کمپین‌منیجر';
  workbook.created = exportedAt;
  function sheet(name: string, headers: string[], rows: unknown[][]) {
    const ws = workbook.addWorksheet(name, {views:[{state:'frozen',ySplit:1,rightToLeft:true}]});
    ws.columns = headers.map((header, i) => ({header,width:i === 0 ? 24 : 38}));
    // Keep user text as string cells, never formula or hyperlink objects. Split long
    // values across continuation rows rather than exceeding Excel's cell limit.
    for (const row of rows) {
      const values = row.map(cell);
      const parts = Math.max(1, ...values.map(v => typeof v === 'string' ? Math.ceil(v.length / 32000) : 1));
      for (let part = 0; part < parts; part++) {
        ws.addRow(values.map(v => typeof v === 'string' && v.length > 32000 ? v.slice(part * 32000, (part + 1) * 32000) : v));
      }
    }
    ws.autoFilter = {from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:headers.length}};
    ws.eachRow((row, index) => {
      row.alignment = {horizontal:'right',vertical:'top',wrapText:true};
      row.font = {name:'Tahoma',size:11,color:{argb:'FF182230'}};
      if (index === 1) {
        row.font = {name:'Tahoma',size:11,bold:true,color:{argb:'FFFFFFFF'}};
        row.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF5655F5'}};
        row.height = 30;
      }
    });
  }
  const completion = object(preview.completion ?? campaign.completion);
  const summary = object(preview.summary);
  const plan = object(campaign.aiPlan);
  const days = records(campaign.days);
  sheet('خلاصه کمپین', ['عنوان','مقدار'], [
    ['نام کمپین',campaign.name],['وضعیت',label(campaign.status)],['محصول',campaign.product],
    ['مخاطب',campaign.audience],['هدف کمپین',campaign.campaignType],['مدت (روز)',campaign.duration],
    ['شروع',date(campaign.startDate)],['سقف محتوای روزانه',campaign.maxContentPerDay],
    ['زمان خروجی (تهران)',date(exportedAt.toISOString())],['روزهای دارای نتیجه',summary.reportedDays],
    ['تعداد کارها',summary.totalTasks],['کارهای انجام‌شده',summary.completedTasks],
    ['راهبرد',plan.strategy],['ایده اصلی',plan.bigIdea],['پیام اصلی',plan.coreMessage],
    ...Object.entries(object(summary.metrics)).map(([key,value]) => [
      ({views:'بازدید',leads:'سرنخ',warmLeads:'علاقه‌مندان',sales:'فروش',revenue:'درآمد (تومان)'} as Data)[key] || key,
      metric(object(value).total),
    ]),
    ...items(summary.limitations).map(value => ['محدودیت گزارش',value]),
  ]);
  sheet('برنامه روزانه', ['روز','تاریخ (تهران)','مرحله','مأموریت','هدف','وضعیت'],
    (days.length ? days : records(plan.days)).map(d => [d.dayNumber,date(d.date),d.phase,d.mission,d.objective,label(d.status)]));
  const tasks: Data[] = days.flatMap(d => records(d.tasks).map(t => ({...t,dayNumber:d.dayNumber})));
  const plannedTasks: Data[] = records(plan.days).flatMap(d => records(d.tasks).map(t => ({...t,dayNumber:d.dayNumber})));
  sheet('کارها و محتوا', ['روز','عنوان','نوع','قالب','وضعیت','هدف','دلیل','اقدام مخاطب','دارایی لازم','محتوا','قفل‌شده','بایگانی‌شده'],
    (days.length ? tasks : plannedTasks).map(t => [t.dayNumber,t.title,label(t.type),t.format,label(t.status),t.objective,t.why,t.cta,t.requiredAsset,t.content,t.locked,t.archived]));
  sheet('نتایج', ['روز','تاریخ (تهران)','نتیجه ثبت شده','ارزیابی','بازدید','سرنخ','علاقه‌مندان','فروش','درآمد (تومان)','یادداشت','بازخورد'],
    days.map(d => {const r = object(d.result);return [d.dayNumber,date(d.date),d.result != null,r.rating,r.views,r.leads,r.warmLeads,r.sales,metric(r.revenue),r.notes,r.feedback];}));
  sheet('آماده‌سازی', ['عنوان','دلیل','قبل از روز','انجام شده'],
    (campaign.preparationInitialized || records(campaign.preparationTasks).length ? records(campaign.preparationTasks) : records(plan.preparation))
      .map(p => [p.title,p.why,p.requiredBeforeDay,p.completed]));
  sheet('آموخته‌ها', ['ردیف','آموخته تأییدشده'], items(completion.learnings).map((v,i) => [i+1,v]));
  sheet('تاریخچه', ['تاریخ (تهران)','منبع تغییر','دلیل','قبل','بعد','پیشنهاد'], records(history).map(h => {
    const data = object(h.data);
    return [date(h.createdAt),h.source,h.reason,data.before,data.after,data.report];
  }));
  // Retain every original field, including draft guidance, AI learnings, and
  // history details that do not have a dedicated column in the readable sheets.
  const details: unknown[][] = [];
  function flatten(value: unknown, path: string) {
    if (value != null && typeof value === 'object' && Object.keys(value).length) {
      for (const [key,child] of Object.entries(value)) flatten(child,`${path}.${key}`);
    } else details.push([path,cell(value)]);
  }
  flatten({exportedAt:exportedAt.toISOString(),campaign,summary:preview,history},'report');
  sheet('جزئیات کامل', ['مسیر اطلاعات','مقدار'], details);
  return workbook.xlsx.writeBuffer();
}

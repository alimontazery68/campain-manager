function fixture(kind='education') {
  const physical=kind==='physical', consulting=kind==='consulting';
  const primaryCTA=consulting?'رزرو مشاوره':'پیام به پشتیبانی برای خرید';
  const before=physical?'کاربرد محصول را نمی‌شناسد':'مشکل را فقط کمبود لغت می‌داند';
  const after=physical?'کاربرد و روش استفاده را می‌داند':'روش تمرین مکالمه را می‌شناسد';
  return {
    schemaVersion:2,strategy:physical?'نمایش کاربرد محصول و کاهش مانع خرید':consulting?'تشخیص مشکل و دعوت به جلسه مشاوره':'شناخت مشکل و معرفی روش تمرین',
    bigIdea:physical?'دیدن کاربرد واقعی':'تمرین روشن و قابل اجرا',coreMessage:'قدم بعدی روشن',primaryCTA,assumptions:[],
    phases:[{name:'شناخت',objective:'فهم راه‌حل',startDay:1,endDay:2,audienceStateBefore:before,audienceStateAfter:after,
      keyMessage:'روش را بشناس',objectionsToAddress:['وقت ندارم'],proofToUse:[],ctaIntensity:2,successSignals:['سؤال مرتبط']}],
    preparation:[{title:'آزمایش مسیر پشتیبانی',why:'رفع مانع اقدام',requiredBeforeDay:1}],
    days:[1,2].map(n=>({dayNumber:n,phase:'شناخت',mission:n===1?(physical?'نمایش روش استفاده از محصول':'توضیح اینکه مشکل مکالمه فقط کمبود لغت نیست'):'توضیح زمان لازم برای استفاده و پاسخ به «وقت ندارم»',
      objective:'اقدام روشن',audienceStateBefore:n===1?before:after,desiredAudienceStateAfter:n===1?after:'می‌تواند درباره اقدام تصمیم بگیرد',
      successSignals:['سؤال مرتبط درباره روش'],ctaIntensity:n===1?1:4,
      decisionPoint:n===2,decisionCriteria:n===2?{whatToCheck:['پرسش‌های زمان'],possibleSignals:['تکرار وقت ندارم'],possibleResponses:['اصلاح توضیح زمان در مأموریت آینده']}:null,
      tasks:[{title:physical?'نمایش کاربرد محصول':'توضیح روش تمرین',type:'CONTENT',format:'متن',objective:'فهم روش',why:'پاسخ به نیاز امروز',cta:primaryCTA,requiredAsset:null},
        {title:'پیگیری محترمانه مخاطبی که قبلاً سؤال کرده',type:'FOLLOW_UP',format:null,objective:'رفع مانع',why:'مسیر خرید از پشتیبانی می‌گذرد',cta:primaryCTA,requiredAsset:null}]}))
  };
}
module.exports={fixture};

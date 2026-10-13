const task=(title='توضیح زمان تمرین')=>({title,type:'CONTENT',format:'متن',objective:'رفع ابهام',why:'بازخورد واقعی درباره وقت',cta:'سؤال مرتبطت را بپرس',requiredAsset:null});
function review(proposedChanges=[],type=proposedChanges.length?'EDIT_TASK':'NO_CHANGE'){
 return {schemaVersion:2,summary:'بررسی محدود به داده ثبت‌شده',facts:[{text:'۱۸ پیام و ۳ فروش ثبت شده است.'}],calculations:[],signals:[{text:'نگرانی درباره زمان و تجربه قبلی در بازخورد آمده است.',evidence:'بازخورد ثبت‌شده روز چهارم'}],hypotheses:[{text:'ممکن است نگرانی زمان یکی از موانع تصمیم بعضی مخاطبان باشد.',confidence:'LOW'}],recommendation:{type,summary:proposedChanges.length?'روشن‌کردن یک ابهام در کار آینده':'ادامه طبق برنامه',reason:'داده محدود است؛ علت فروش ثابت نشده.',proposedChanges},missingInformation:[],limitations:['داده محدود است و رابطه علت و معلول ثابت نیست.']};
}
module.exports={task,review};

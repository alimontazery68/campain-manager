const calendar=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
export function persianParts(date:Date){
 const parts=calendar.formatToParts(date);
 const get=(name:string)=>Number(parts.find(p=>p.type===name)?.value);
 return {year:get('year'),month:get('month'),day:get('day')};
}
export const persianDateText=(year:number,month:number,day:number)=>`${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
export function isoToPersian(iso:string){const p=persianParts(new Date(iso+'T12:00:00Z'));return persianDateText(p.year,p.month,p.day);}
export function persianToIso(value:string):string|null{
 const normalized=value.trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 const match=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized);
 if(!match)return null;
 const [,ys,ms,ds]=match,year=Number(ys),month=Number(ms),day=Number(ds);
 if(year<1000||year>2999||month<1||month>12||day<1||day>31)return null;
 const target=year*10000+month*100+day;
 // Search Gregorian days using the browser's Persian calendar, including leap years.
 let lo=Math.floor(Date.UTC(year+621,0,1)/86400000),hi=Math.floor(Date.UTC(year+623,0,1)/86400000);
 while(lo<=hi){const middle=Math.floor((lo+hi)/2),date=new Date(middle*86400000),p=persianParts(date),key=p.year*10000+p.month*100+p.day;
  if(key===target)return date.toISOString().slice(0,10);
  if(key<target)lo=middle+1;else hi=middle-1;
 }
 return null;
}

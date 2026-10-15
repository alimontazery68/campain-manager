import type { ComponentPropsWithoutRef } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, FileDown, FilePenLine, FileText, HelpCircle, History, Layers, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
const icons={document:FileText,edit:FilePenLine,chart:BarChart3,calendar:CalendarDays,check:CheckCircle2,download:FileDown,help:HelpCircle,history:History,layers:Layers,settings:Settings2,shield:ShieldCheck,sparkles:Sparkles,plan:ClipboardList};
export default function DisclosureSummary({children,icon='document',className='',...props}:ComponentPropsWithoutRef<'summary'>&{icon?:keyof typeof icons}){
 const Icon=icons[icon];
 return <summary {...props} className={'disclosure-summary '+className}><span className="disclosure-icon" aria-hidden="true"><Icon size={19}/></span><span className="disclosure-label">{children}</span><ChevronDown className="disclosure-chevron" size={19} aria-hidden="true"/></summary>;
}

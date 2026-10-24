import {z} from 'zod';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const GuideIdSchema=z.enum(['main','mini','flash','private','webinar','challenge','hybrid']);
export type GuideId=z.infer<typeof GuideIdSchema>;
const text=z.string().min(1),texts=z.array(text).min(1);
export const GuideSchema=z.object({id:GuideIdSchema,version:text,reviewedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),title:text,summary:text,suitableWhen:texts,notSuitableWhen:texts,requirements:texts,stages:z.array(z.object({title:text,description:text}).strict()).min(1),example:z.object({kind:z.literal('hypothetical'),text}).strict(),commonMistakes:texts,startChecklist:texts,measurement:texts,durationRule:text,learningNote:text,agent:z.object({selectionSummary:text,avoidWhen:text,askBeforeSelection:texts,planningRequirements:texts,contentRequirements:texts,validationChecks:texts}).strict()}).strict();
export const GuideBundleSchema=z.object({schemaVersion:z.literal('1.0'),guideVersion:text,language:z.literal('fa'),guides:z.array(GuideSchema).length(7),productRules:texts,evidenceScope:text}).strict().superRefine((b,ctx)=>{if(new Set(b.guides.map(g=>g.id)).size!==7)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Seven distinct guide IDs required'});});
const candidates=[resolve(process.cwd(),'project-guides/campaign-guides.fa.json'),resolve(process.cwd(),'../../project-guides/campaign-guides.fa.json'),resolve(__dirname,'../../../project-guides/campaign-guides.fa.json'),resolve(__dirname,'../../../../project-guides/campaign-guides.fa.json')];
const file=candidates.find(existsSync);
if(!file)throw new Error('Missing project-guides/campaign-guides.fa.json');
export const guideBundle=GuideBundleSchema.parse(JSON.parse(readFileSync(file,'utf8')));
export const guideVersion=guideBundle.guideVersion;
export const guideDigest=createHash('sha256').update(JSON.stringify(guideBundle)).digest('hex');
export const guideById=Object.fromEntries(guideBundle.guides.map(g=>[g.id,g])) as Record<GuideId,z.infer<typeof GuideSchema>>;
export function publicGuides(){return {guideVersion,language:guideBundle.language,evidenceScope:guideBundle.evidenceScope,guides:guideBundle.guides.map(g=>{const {agent,...education}=g;void agent;return education;})};}
export function selectedIds(method:any):GuideId[]{if(!method)return [];return [...new Set([method.id,...(method.id==='hybrid'?method.components??[]:[])])].filter((id):id is GuideId=>GuideIdSchema.safeParse(id).success);}
export function guideSelectionSummaries(ids:GuideId[]){return ids.map(id=>{const g=guideById[id];return {id,title:g.title,version:g.version,summary:g.agent.selectionSummary,avoidWhen:g.agent.avoidWhen,askBeforeSelection:g.agent.askBeforeSelection};});}
export function planningGuides(method:any){return selectedIds(method).map(id=>{const g=guideById[id];return {id,version:g.version,stages:g.stages,durationRule:g.durationRule,requirements:g.requirements,planningRequirements:g.agent.planningRequirements,validationChecks:g.agent.validationChecks};});}
export const GuideRefSchema=z.object({methodId:GuideIdSchema,stageIndex:z.number().int().nonnegative()}).strict();
export function contentGuide(method:any,ref:unknown,authored?:{guideVersion?:string;guideDigest?:string}){
 const ids=selectedIds(method),parsed=GuideRefSchema.safeParse(ref);
 const sameVersion=(!authored?.guideVersion||authored.guideVersion===guideVersion)&&(!authored?.guideDigest||authored.guideDigest===guideDigest);
 if(sameVersion&&parsed.success&&ids.includes(parsed.data.methodId)){
  const g=guideById[parsed.data.methodId],stage=g.stages[parsed.data.stageIndex];
  if(stage)return {guideVersion,guideDigest,methodId:g.id,stageIndex:parsed.data.stageIndex,stage,rules:g.agent.contentRequirements};
 }
 // Legacy plans have no reliable stage mapping. Never infer a stage from a day number.
 return {guideVersion,guideDigest,stage:null,rules:[...new Set(ids.flatMap(id=>guideById[id].agent.contentRequirements))],legacyStageUnmapped:true};
}
export function validateGuideRefs(plan:any,method:any,requireMapping=false){const ids=selectedIds(method);for(const d of plan.days)for(const t of d.tasks){if(requireMapping&&ids.length&&t.type==='CONTENT'&&!t.guideRef)throw new Error('New content task needs an explicit guide stage');if(t.guideRef&&(!ids.includes(t.guideRef.methodId)||!guideById[t.guideRef.methodId as GuideId]?.stages[t.guideRef.stageIndex]))throw new Error('Invalid selected guide stage');}}
export function goalMeasurement(goal:string,method:any){
 const fields=/لید|جذب مشتری/.test(goal)?['leads']:/پرورش/.test(goal)?['views','leads','feedback']:/وفادار/.test(goal)?['feedback']:['sales','revenue'];
 return {goal,fields,methodMeasures:selectedIds(method).map(id=>({id,measurement:guideById[id].measurement})),rules:'Only recorded metrics; unknown is not zero. Retention, repeat purchase and upsell cannot be inferred from total sales without customer-level evidence. Never substitute sales achievement for task progress.'};
}

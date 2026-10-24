import { z } from 'zod';
import { acceptedMethod } from './campaign-methods';
const value = z.string().trim().min(1).max(3000);
export const ProofAssetSchema = z.object({
  type:value, description:value.optional(), count:z.number().int().nonnegative().optional()
}).strict();
export const ConversionPathSchema = z.object({
  action:value, details:z.string().max(3000).optional(), steps:z.array(value).max(20).optional()
}).strict();
export const ExecutionProfileSchema = z.object({
  platform:z.string().trim().min(1).max(100).nullable().optional(),
  familiarity:z.enum(['unknown','cold','aware','customer']).default('unknown'),
  audienceSize:z.number().int().nonnegative().nullable().optional(),
  averageViews:z.number().int().nonnegative().nullable().optional(),
  privateReplies:z.enum(['unknown','yes','no']).default('unknown'),
  calls:z.enum(['unknown','yes','no']).default('unknown'),
  onlineSession:z.enum(['unknown','yes','no']).default('unknown'),
  adBudget:z.number().int().nonnegative().nullable().optional(),
  constraints:z.string().max(2000).optional()
}).strict();
export const PlanningContextSchema = z.object({
  executionProfile:ExecutionProfileSchema.optional(),
  methodRequired:z.boolean().optional(),
  methodState:z.unknown().optional(),
  methodQuestionsAnswered:z.array(z.string().max(100)).max(9).optional(),
  objections:z.array(value).max(30).nullable().optional(),
  proofAssets:z.array(ProofAssetSchema).max(30).nullable().optional(),
  availableContentFormats:z.array(value).max(20).nullable().optional(),
  conversionPath:ConversionPathSchema.nullable().optional(),
  previousLearnings:z.array(value).max(30).nullable().optional()
}).strict();
export type PlanningContext = z.infer<typeof PlanningContextSchema>;
export const PlanningInputSchema = z.object({
  businessType:value, campaignType:value, product:z.string().trim().min(1).max(5000),
  audience:z.string().nullable(), problem:z.string().nullable(), outcome:z.string().nullable(),
  offer:z.unknown(), conversionPath:ConversionPathSchema.nullable(),
  duration:z.number().int().min(1).max(14), target:z.number().int().nonnegative().nullable(),
  maxContentPerDay:z.number().int().min(1).max(4),
  objections:PlanningContextSchema.shape.objections,
  proofAssets:PlanningContextSchema.shape.proofAssets,
  availableContentFormats:PlanningContextSchema.shape.availableContentFormats,
  executionProfile:ExecutionProfileSchema.optional(),
  selectedMethod:z.unknown().optional(),
  previousLearnings:PlanningContextSchema.shape.previousLearnings
}).strict();
export type PlanningInput = z.infer<typeof PlanningInputSchema>;
type Source = {
  businessType:string; campaignType:string; product:string; audience:string|null; problem:string|null;
  outcome:string|null; offer:unknown; salesPath:unknown; duration:number; target:number|null;
  maxContentPerDay:number; planningContext?:unknown;
};
export function buildPlanningInput(campaign:Source):PlanningInput {
  const context=PlanningContextSchema.parse(campaign.planningContext ?? {});
  // Explicit null means unknown; [] means the user explicitly supplied no assets.
  const hasPath=Object.prototype.hasOwnProperty.call(context,'conversionPath');
  const path=hasPath?context.conversionPath:campaign.salesPath;
  return PlanningInputSchema.parse({
    businessType:campaign.businessType,campaignType:campaign.campaignType,product:campaign.product,
    audience:campaign.audience,problem:campaign.problem,outcome:campaign.outcome,offer:campaign.offer,
    conversionPath:path ?? null,duration:campaign.duration,target:campaign.target,
    maxContentPerDay:campaign.maxContentPerDay,executionProfile:context.executionProfile,selectedMethod:acceptedMethod(campaign)??undefined,objections:context.objections,
    proofAssets:context.proofAssets,availableContentFormats:context.availableContentFormats,
    previousLearnings:context.previousLearnings
  });
}

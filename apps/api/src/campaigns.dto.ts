import { z } from 'zod';
import { PlanningContextSchema } from './ai/planning-context';
export const CreateCampaignSchema = z.object({
  ...PlanningContextSchema.omit({methodState:true}).shape,
  name: z.string().trim().min(2).max(200), businessType: z.string().trim().min(1).max(200), campaignType: z.string().trim().min(1).max(200), product: z.string().trim().min(2).max(5000),
  audience: z.string().max(5000).optional(), problem: z.string().max(5000).optional(), outcome: z.string().max(5000).optional(), duration: z.number().int().min(1).max(90), target: z.number().int().nonnegative().optional(),
  startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const date=new Date(s+'T12:00:00.000Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s;}).optional(),
  offer: z.object({ kind: z.string().max(200), details: z.string().max(2000),regularPrice:z.string().max(200).optional(),campaignPrice:z.string().max(200).optional(),bonus:z.string().max(1000).optional(),deadline:z.string().max(200).optional(),capacity:z.string().max(200).optional(),paymentTerms:z.string().max(1000).optional() }),
  maxContentPerDay: z.number().int().min(1).max(4).default(1),
  salesPath: z.object({ action: z.string().min(1).max(200), details: z.string().max(2000) })
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

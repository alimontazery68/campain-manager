export interface AiProvider {
  json(system: string, input: unknown, options?:{maxOutputTokens?:number}): Promise<unknown>;
}
export const AI_PROVIDER = Symbol('AI_PROVIDER');

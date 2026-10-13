export interface AiProvider {
  json(system: string, input: unknown): Promise<unknown>;
}
export const AI_PROVIDER = Symbol('AI_PROVIDER');

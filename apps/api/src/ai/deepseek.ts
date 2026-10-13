import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { AiProvider } from './provider';
import { optimizationPrompt } from './optimization';
import { mockOptimization } from './optimization-mock';
const ResponseSchema = z.object({choices:z.array(z.object({finish_reason:z.string(),message:z.object({content:z.string()})})).min(1)});
@Injectable()
export class DeepSeekProvider implements AiProvider {
  async json(system: string, input: unknown): Promise<unknown> {
    if(process.env.AI_MOCK_MODE==='true'){
      if(process.env.NODE_ENV!=='development')throw new ServiceUnavailableException('حالت آزمایشی فقط با NODE_ENV=development مجاز است.');
      if(system===optimizationPrompt)return mockOptimization(input);
      throw new ServiceUnavailableException('حالت آزمایشی این مرحله فقط بررسی کمپین را پشتیبانی می‌کند؛ هیچ درخواست واقعی ارسال نشد.');
    }
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new ServiceUnavailableException('کلید DeepSeek هنوز در تنظیمات بک‌اند وارد نشده است.');
    try {
      const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
      const response = await fetch(base + '/chat/completions', {
        method:'POST', signal:AbortSignal.timeout(120000),
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
        body:JSON.stringify({model:process.env.DEEPSEEK_MODEL || 'deepseek-chat',response_format:{type:'json_object'},max_tokens:8000,
          messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}]})
      });
      if (!response.ok) throw new Error('Provider error');
      const result = ResponseSchema.parse(await response.json()).choices[0];
      if (result.finish_reason !== 'stop') throw new Error('Incomplete response');
      return JSON.parse(result.message.content);
    } catch {
      throw new ServiceUnavailableException('در ساخت پیشنهاد مشکلی پیش آمد. اطلاعات کمپین محفوظ است؛ دوباره تلاش کن.');
    }
  }
}

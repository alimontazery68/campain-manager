import { PrismaClient, TaskType, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();
const dayTemplates = [
  ['آگاهی از مسئله', 'شروع گفتگو درباره مشکل اصلی مخاطب', 'مخاطب مشکل را بهتر بشناسد'],
  ['آموزش کاربردی', 'یک راهکار ساده و قابل اجرا ارائه کن', 'اعتماد اولیه ایجاد شود'],
  ['اشتباهات رایج', 'موانع و خطاهای رایج را توضیح بده', 'نیاز به راهکار جدی‌تر روشن شود'],
  ['معرفی راهکار', 'محصول و روش استفاده از آن را معرفی کن', 'مخاطب با راهکار آشنا شود'],
  ['اثبات و نمونه', 'نمونه استفاده و مزیت‌های واقعی را نشان بده', 'تردید مخاطب کمتر شود'],
  ['پیشنهاد اقدام', 'پیشنهاد مشخص و مسیر تماس را اعلام کن', 'مخاطب اقدام موردنظر را انجام دهد'],
  ['پیگیری', 'سؤالات و اعتراض‌های معمول را پاسخ بده', 'مخاطب مردد برای اقدام آماده شود'],
];

async function main() {
  const creationKey = 'seed-campain-manager-demo-v1';
  const existing = await prisma.campaign.findUnique({ where: { creationKey } });
  if (existing) { console.log(`Seed already exists: ${existing.id}`); return; }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const campaign = await prisma.campaign.create({
    data: {
      creationKey, name: 'کمپین نمونه فروش محصول', businessType: 'فروش محصول',
      campaignType: 'فروش و جذب مشتری', product: 'محصول نمونه برای تست محیط تولید',
      audience: 'افرادی که به دنبال یک راهکار ساده و قابل اعتماد هستند',
      problem: 'مخاطب در انتخاب راهکار مناسب و شروع استفاده سردرگم است',
      outcome: 'مخاطب اطلاعات کافی بگیرد و برای دریافت مشاوره اقدام کند',
      offer: { kind: 'مشاوره اولیه', details: 'پاسخ به سؤال‌های اولیه و معرفی مسیر مناسب' },
      salesPath: { channel: 'پیام مستقیم', cta: 'برای دریافت مشاوره پیام بدهید' },
      duration: dayTemplates.length, startDate, target: 20, maxContentPerDay: 1,
      status: CampaignStatus.ACTIVE, preparationInitialized: true,
      preparationTasks: { create: [
        { position: 0, title: 'آماده‌سازی معرفی محصول', why: 'پاسخ یکدست به سؤال‌های مخاطب' },
        { position: 1, title: 'آماده‌سازی مسیر تماس', why: 'دریافت و پیگیری پیام‌ها' },
      ] },
      aiPlan: { strategy: 'آموزش کوتاه، معرفی راهکار و دعوت تدریجی به مشاوره',
        bigIdea: 'انتخاب راهکار مناسب می‌تواند ساده و مرحله‌به‌مرحله باشد',
        coreMessage: 'قبل از خرید، مسئله و مسیر مناسب را روشن کنید',
        primaryCTA: 'برای دریافت مشاوره پیام بدهید' },
      days: { create: dayTemplates.map(([phase, mission, objective], index) => ({
        dayNumber: index + 1, date: new Date(startDate.getTime() + index * 86400000),
        phase, mission, objective, guidance: { note: 'محتوا را کوتاه، واقعی و قابل اجرا نگه دارید.' },
        tasks: { create: [{ title: index === 5 ? 'دعوت به دریافت مشاوره' : `محتوای روز ${index + 1}`,
          type: index === 5 ? TaskType.SALES : TaskType.CONTENT, format: 'پست متنی کوتاه',
          cta: index === 5 ? 'برای دریافت مشاوره پیام بدهید' : 'نظر و سؤال خود را ارسال کنید',
          why: mission, objective, position: 0 }] },
      })) },
    },
  });
  console.log(`Seed created campaign ${campaign.id}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

# اجرای بدون Docker روی ویندوز

PostgreSQL 16 روی این سیستم نصب است و سرویس `postgresql-x64-16` فعال است. نیازی به Docker ندارید.

تنظیمات اصلی در `apps/api/.env` هستند. فایل موجود را باز کنید و رمز واقعی کاربر PostgreSQL را در آدرس زیر قرار دهید:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/campaign_manager?schema=public"
API_PORT=4000
WEB_PORT=3000
```

کاراکترهای خاص رمز باید برای URL کدگذاری شوند. فایل .env را در Git قرار ندهید. بک‌اند و Prisma فایل محیطی apps/api را می‌خوانند.

سپس از ریشه پروژه اجرا کنید:

```powershell
npm run prisma:generate --prefix apps/api
npm run prisma:migrate --prefix apps/api -- --name init
node scripts/check-database.cjs
npm run dev
```

Prisma در صورت داشتن مجوز کافی، دیتابیس را ایجاد می‌کند. در صورت خطای مجوز ساخت دیتابیس، دیتابیس campaign_manager را در pgAdmin ایجاد کنید و migration را با کاربری دارای مجوز اجرا کنید.

فرانت: http://localhost:3000

بک‌اند: http://localhost:4000/health

پورت‌ها را در فایل محیطی تغییر دهید اگر اشغال‌اند. PostgreSQL باید هنگام اجرای بک‌اند فعال باشد. توقف اپلیکیشن با Ctrl+C انجام می‌شود.

خطای P1000 یعنی نام کاربری یا رمز PostgreSQL نادرست است. خطای P1001 یعنی سرور دیتابیس در دسترس نیست. اسکریپت check-database اتصال و وجود جدول کمپین را بدون چاپ رمز بررسی می‌کند.

رابط اکنون به API وصل است و ساخت کمپین و ثبت انجام کارها در دیتابیس ذخیره می‌شود. DeepSeek با تنظیم کلید API و دکمه ساخت طرح فعال می‌شود؛ احراز هویت هنوز تکمیل نشده است.

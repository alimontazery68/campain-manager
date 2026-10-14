# اتصال سریع OTP به IPPanel

نیازمندی: Node.js 18 یا جدیدتر. این ابزار هیچ dependency ندارد.

1. مقادیر `ippanel-otp.env.example` را در `.env` پروژه مقصد قرار بده.
2. کلید API را فقط در `.env` محلی یا secretهای سرور بگذار؛ آن را commit نکن.
3. بررسی تنظیمات:

```bash
node scripts/ippanel-otp.cjs check
```

4. تست ارسال:

```bash
node scripts/ippanel-otp.cjs send 09133731108
```

برای استفاده در کد Node/Nest:

```js
const { sendOtp } = require('./scripts/ippanel-otp.cjs');
await sendOtp('09133731108');
```

این ابزار ارسال به IPPanel را استاندارد می‌کند؛ ذخیره OTP، محدودیت resend، تأیید کد و ایجاد session باید در پروژه مقصد بر اساس دیتابیس و معماری همان پروژه پیاده‌سازی شود.

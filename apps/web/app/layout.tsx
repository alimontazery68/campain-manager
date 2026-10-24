import './globals.css';
import './daily-experience.css';
export const metadata = { title: 'کمپین‌منیجر', description: 'مدیر کمپین برای کانال‌های فارسی' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }

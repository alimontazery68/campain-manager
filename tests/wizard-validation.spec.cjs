const {test,expect}=require('@playwright/test');
test('three-step validation allows unknown audience and rejects incomplete proof',async({page})=>{
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'test'}}}));
 await page.route('**/api/campaigns',r=>r.fulfill({json:[]}));
 await page.goto('/');await page.locator('.empty-state .primary').click();const w=page.getByRole('dialog'),next=w.getByRole('button',{name:'ادامه',exact:true});
 await expect(next).toBeDisabled();await w.getByLabel('نام کمپین',{exact:true}).fill('تست اعتبارسنجی');await w.getByLabel('چه محصول یا خدمتی').fill('محصول واقعی');await w.getByLabel('هدف اصلی').selectOption('افزایش فروش');await expect(next).toBeEnabled();
 await w.getByText('دقیق‌تر بساز (اختیاری)',{exact:true}).click();await w.getByLabel('جزئیات برنامه').selectOption('detailed');
 await w.getByRole('combobox',{name:'وضعیت اطلاعات',exact:true}).nth(1).selectOption('known');await expect(next).toBeDisabled();await expect(w.getByRole('alert')).toContainText('شاهد واقعی');
 await w.getByRole('combobox',{name:'وضعیت اطلاعات',exact:true}).nth(1).selectOption('none');await expect(next).toBeEnabled();await next.click();await expect(w.getByLabel('پلتفرم اصلی')).toBeVisible();
});

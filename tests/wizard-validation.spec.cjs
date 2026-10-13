const {test,expect}=require('@playwright/test');
test('missing information blocks its own wizard step and optional unknowns remain allowed',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'کمپین جدید',exact:true}).click();const w=page.getByRole('dialog'),next=w.getByRole('button',{name:'ادامه',exact:true});
 await expect(next).toBeDisabled();await expect(w.getByRole('alert')).toContainText('نوع کسب‌وکار');
 await w.getByRole('button',{name:'دقیق‌تر بساز',exact:true}).click();await w.getByRole('button',{name:'آموزش / دوره',exact:true}).click();await next.click();
 await expect(next).toBeDisabled();await w.getByRole('button',{name:'فروش یک محصول',exact:true}).click();await next.click();
 await expect(next).toBeDisabled();await w.getByLabel('نام کمپین',{exact:true}).fill('تست اعتبارسنجی');await w.getByLabel('نام محصول و کاری که برای مشتری انجام می‌دهد').fill('محصول واقعی');await next.click();
 await w.getByRole('button',{name:'مشخص است',exact:true}).nth(1).click();await expect(next).toBeDisabled();await expect(w.getByRole('button',{name:'نمی‌دانم — فعلاً ادامه بده',exact:true})).toBeDisabled();await expect(w.getByRole('alert')).toContainText('شاهد واقعی');
 await w.getByRole('button',{name:'هیچ شاهدی ندارم',exact:true}).click();await expect(next).toBeEnabled();await next.click();
 await w.getByRole('button',{name:'هدیه دارم',exact:true}).click();await expect(next).toBeDisabled();await expect(w.getByRole('alert')).toContainText('هدیه واقعی');await w.getByLabel('هدیه واقعی',{exact:true}).fill('راهنمای استفاده');await expect(next).toBeEnabled();
});

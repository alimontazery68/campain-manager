const { test, expect } = require('@playwright/test');

test('login and three-step campaign wizard work without paid services', async ({ page }) => {
  let loggedIn = false;
  const campaign = {
    id: 'test-campaign', name: 'کمپین تست', product: 'خدمت تست', audience: 'مخاطب تست',
    duration: 7, status: 'DRAFT', days: [], maxContentPerDay: 1,
    preparationTasks: [], updatedAt: new Date().toISOString(), aiPlan: null,
  };
  await page.route('**/api/auth/session', route => route.fulfill({ status: loggedIn ? 200 : 401, contentType: 'application/json', body: JSON.stringify(loggedIn ? { user: { id: 'u1', phone: '09120000000' } } : { message: 'Unauthorized' }) }));
  await page.route('**/api/auth/request-otp', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ message: 'کد تایید ارسال شد.' }) }));
  await page.route('**/api/auth/verify-otp', route => { loggedIn = true; return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'set-cookie': 'campaign_session=test; Path=/' }, body: JSON.stringify({ user: { id: 'u1', phone: '09120000000' } }) }); });
  await page.route('**/api/auth/logout', route => { loggedIn = false; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); });
  await page.route('**/api/campaigns', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(campaign) });
  });

  await page.goto('/');
  await expect(page.getByText('ورود به کمپین‌منیجر')).toBeVisible();
  await page.locator('input[placeholder="09121234567"]').fill('09120000000');
  await page.getByRole('button', { name: 'دریافت کد تایید' }).click();
  await page.locator('input[inputmode="numeric"]').fill('12345');
  await page.getByRole('button', { name: 'ورود' }).click();
  await page.reload();
  await expect(page.locator('.empty-state')).toBeVisible();
  if (test.info().project.name === 'mobile') {
    await page.locator('[data-nav="reports"]').click();
    await expect(page.locator('.empty-state')).toBeVisible();
  }
  await page.locator('.empty-state .primary').click();
  const wizard = page.locator('.simple-wizard');
  await expect(wizard).toBeVisible();
  const inputs = wizard.locator('input');
  const textareas = wizard.locator('textarea');
  await inputs.nth(0).fill('کمپین تست');
  await textareas.nth(0).fill('خدمت تست');
  await wizard.locator('select').nth(0).selectOption({ label: 'افزایش فروش' });
  await textareas.nth(1).fill('مخاطب تست');
  await wizard.getByRole('button', { name: 'ادامه' }).click();
  await wizard.locator('select').nth(0).selectOption({ label: 'اینستاگرام' });
  await wizard.locator('select').nth(2).selectOption({ label: 'ارسال پیام' });
  await wizard.getByRole('button', { name: 'ادامه' }).click();
  await expect(wizard.getByText('کمپین تست')).toBeVisible();
  await wizard.getByRole('button', { name: 'ساخت کمپین' }).click();
  await expect(wizard).not.toBeVisible();
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await expect(page.getByText('ورود به کمپین‌منیجر')).toBeVisible();
});

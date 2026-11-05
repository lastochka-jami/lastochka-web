import { test, expect } from '@playwright/test';

test('shop pages, navigation, session and local resources stay below /shop', async ({ page, request }) => {
  const failures: string[] = [];
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:3011/shop/') && response.status() >= 400) failures.push(response.url());
  });
  for (const path of ['/', '/catalog', '/search?query=салат', '/product/10', '/profile', '/cart', '/payment?orderId=10', '/cards?binding=return']) {
    const response = await page.goto('/shop' + path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  const session = await request.get('/shop/api/session');
  expect(session.status()).toBe(200);
  expect((await session.json()).checkoutEnabled).toBe(false);
  expect(session.headers()['set-cookie']).toContain('Path=/shop');
  for (const path of ['/shop/images/swallow.webp', '/shop/images/brand-icon-v2.webp', '/shop/manifest.webmanifest', '/shop/brand-icon-192-v2.png']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  await page.goto('/shop/');
  await page.getByRole('link', { name: 'Каталог', exact: true }).first().click();
  await expect(page).toHaveURL(/\/shop\/catalog$/);
  expect(failures).toEqual([]);
});

test('guest cart survives navigation while checkout remains disabled', async ({ page }) => {
  await page.goto('/shop/search?query=салат');
  await page.locator('.product-card').first().locator('.pill-buy-btn').click();
  await page.goto('/shop/cart');
  await expect(page.locator('.cart-item-name').first()).toContainText('Порция');
  await page.reload();
  await expect(page.locator('.cart-item-name').first()).toContainText('Порция');
  await expect(page.getByRole('button', { name: /Оформить заказ|Оплатить/ })).toHaveCount(0);
});

test('phone login and OTP use shop API paths with intercepted SMS', async ({ page }) => {
  let sends = 0;
  await page.route('**/shop/api/shop/auth/phone-login', async route => {
    sends++;
    await route.fulfill({ json: { data: { codeLength: 6 } } });
  });
  await page.route('**/shop/api/shop/auth/phone-confirm', route => route.fulfill({ status: 422, json: { message: 'Тестовый код' } }));
  await page.goto('/shop/profile');
  await page.getByRole('button', { name: 'Войти по телефону' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Номер телефона').fill('8 (999) 123-45-67');
  await dialog.getByRole('button', { name: 'Получить код' }).click();
  await dialog.getByLabel('Код подтверждения').fill('123456');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Тестовый код');
  expect(sends).toBe(1);
});


test('both storefront origins can use the mounted mutation handler; foreign origins cannot', async ({ request }) => {
  const sessionResponse = await request.get('/shop/api/session');
  const session = await sessionResponse.json();
  // APIRequestContext does not send Secure cookies over HTTP; supply the fixture cookie explicitly.
  const cookie = sessionResponse.headers()['set-cookie'].split(';')[0];
  for (const origin of ['http://127.0.0.1:3011', 'http://localhost:3011']) {
    const response = await request.post('/shop/api/store', {
      headers: { cookie, origin, 'x-csrf-token': session.csrf, 'sec-fetch-site': 'same-origin' },
      data: { storeId: 2 },
    });
    expect(response.status()).toBe(200);
  }
  const foreign = await request.post('/shop/api/store', {
    headers: { cookie, origin: 'https://foreign.test', 'x-csrf-token': session.csrf }, data: { storeId: 2 },
  });
  expect(foreign.status()).toBe(403);
});

import { test, expect, type Page } from '@playwright/test';

async function mockAccount(page: Page) {
  await page.route('**/api/shop/**', route => route.fulfill({json:{data:[]}}));
  await page.route('**/api/session', route => route.fulfill({json:{authenticated:true,csrf:'account-a',storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/auth/profile', route => route.fulfill({json:{data:{id:1,bonusBalance:125}}}));
}

test('bonus API failure does not become zero and does not block loyalty QR', async ({page}) => {
  await mockAccount(page);
  let fail = true;
  await page.route('**/api/shop/auth/profile', route => route.fulfill(fail ? {status:503,json:{message:'Профиль временно недоступен'}} : {json:{data:{id:1,bonusBalance:125}}}));
  await page.route('**/api/shop/loyalty-card', route => route.fulfill({json:{status:'active',cardNumber:'123456',qrPayload:'123456',balance:999}}));
  await page.goto('/shop/bonuses');
  const balance = page.locator('.loyalty-number-text');
  await expect(balance).toContainText('Не удалось загрузить бонусы');
  await expect(page.locator('.loyalty-qr-img')).toBeVisible();
  fail = false;
  await balance.getByRole('button').click();
  await expect(balance).toHaveText('125');
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForResponse(response => response.url().endsWith('/auth/profile') && response.status() === 503);
  await expect(balance).toHaveText('125');
  await page.getByRole('button',{name:'QR-код карты постоянного покупателя'}).click();
  await expect(page.getByText('123456',{exact:true})).toBeVisible();
  await expect(page.locator('.qr-panel')).toContainText('125 бонусов');
});

test('account switch clears the previous balance while the new profile loads', async ({page}) => {
  await mockAccount(page);
  let account = 1;
  let release!: () => void;
  await page.route('**/api/session', route => route.fulfill({json:{authenticated:true,csrf:'account-'+account,storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/auth/profile', async route => {
    const id = account;
    if (id === 2) await new Promise<void>(resolve => {release = resolve;});
    await route.fulfill({json:{data:{id,bonusBalance:id === 1 ? 125 : 20}}});
  });
  await page.goto('/shop/bonuses');
  const balance = page.locator('.loyalty-number-text');
  await expect(balance).toHaveText('125');
  account = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(balance).toContainText('Загружаем');
  release();
  await expect(balance).toHaveText('20');
});

test('binding refusal 422 preserves API message and returnUrl error is distinct', async ({page}) => {
  await mockAccount(page);
  let domain = false;
  await page.route('**/api/shop/payment-cards/bind', route => route.fulfill({status:422,json:domain ? {message:'Validation failed',errors:{returnUrl:['Invalid host']}} : {message:'Банк отклонил привязку'}}));
  await page.goto('/shop/cards');
  await page.getByRole('button',{name:'Привязать карту',exact:true}).first().click();
  const submit = page.getByRole('button',{name:'Перейти к привязке карты'});
  await submit.click();
  await expect(page.locator('.bind-error-box')).toContainText('Банк отклонил привязку');
  await expect(page.locator('.bind-error-box')).not.toContainText('домен');
  domain = true;
  await submit.click();
  await expect(page.locator('.bind-error-box')).toContainText('адрес возврата');
});

test('success URL alone never confirms binding and polling stops with a retry action', async ({page}) => {
  await mockAccount(page);
  let calls = 0;
  await page.route('**/api/shop/payment-cards', route => {calls++; return route.fulfill({json:{data:[{id:1,last4:'1111'}]}});});
  await page.goto('/shop/cards?binding=success');
  await expect(page.getByText('Проверяем привязку карты.',{exact:false})).toBeVisible();
  await expect(page.getByText('Привязка пока не подтверждена.',{exact:false})).toBeVisible({timeout:15000});
  await expect(page.getByText('Карта привязана.',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Проверить ещё раз'})).toBeVisible();
  const completed = calls;
  await page.waitForTimeout(2300);
  expect(calls).toBe(completed);
});

for (const host of ['127.0.0.1', 'localhost']) {
  test(`payment roundtrip preserves real BFF session on ${host} and waits for server card`, async ({page,context}) => {
    const origin = `http://${host}:3011`;
    await page.goto(origin+'/shop/cards');
    await page.evaluate(async () => {
      const session = await fetch('/shop/api/session').then(r => r.json());
      const response = await fetch('/shop/api/shop/auth/phone-confirm', {method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':session.csrf},body:JSON.stringify({phone:'+79990000000',code:'123456'})});
      if (!response.ok) throw new Error('Fixture login failed: '+response.status);
    });
    await page.reload();
    await expect(page.getByRole('heading',{name:'Способы оплаты'})).toBeVisible();
    const cookieBefore = (await context.cookies()).find(cookie => cookie.name === 'lastochka_session');
    expect(cookieBefore?.value).toBeTruthy();
    expect(cookieBefore?.sameSite).toBe('Lax');
    expect(cookieBefore?.path).toBe('/shop');
    let returned = false;
    let checks = 0;
    await page.route('**/api/shop/payment-cards', route => {
      if (returned) checks++;
      return route.fulfill({json:{data:returned && checks >= 3 ? [{id:22,last4:'4242',cardType:'Visa'}] : []}});
    });
    await page.route('https://payment.example.test/**', async route => {
      const returnUrl = new URL(route.request().url()).searchParams.get('returnUrl')!;
      expect(new URL(returnUrl).origin).toBe(origin);
      expect(new URL(returnUrl).pathname).toBe('/shop/cards');
      await route.fulfill({contentType:'text/html; charset=utf-8',body:`<a href="${returnUrl}">Вернуться в Ласточку</a>`});
    });
    await page.getByRole('button',{name:'Привязать карту',exact:true}).first().click();
    await page.getByRole('button',{name:'Перейти к привязке карты'}).click();
    await expect(page).toHaveURL(/payment.example.test/);
    returned = true;
    await page.getByRole('link',{name:'Вернуться в Ласточку'}).click();
    await expect(page).toHaveURL(origin+'/shop/cards?binding=return');
    await expect(page.getByText('Проверяем привязку карты.',{exact:false})).toBeVisible();
    await expect(page.getByText('Карта привязана. Список карт обновлён.',{exact:true})).toBeVisible();
    await expect(page.locator('.card-info')).toContainText('4242');
    const session = await page.evaluate(() => fetch('/shop/api/session').then(r => r.json()));
    expect(session.authenticated).toBe(true);
    expect(session.publicOrigin).toBe(origin);
    expect((await context.cookies()).find(cookie => cookie.name === 'lastochka_session')?.value).toBe(cookieBefore?.value);
  });
}

test('real API order shape without canCancel permits cancellation and refreshes shared balance', async ({page}) => {
  await mockAccount(page);
  let cancelled = false;
  let profileReads = 0;
  await page.route('**/api/shop/auth/profile', route => {
    profileReads++;
    return route.fulfill({json:{data:{id:1,bonusBalance:cancelled ? 135 : 125}}});
  });
  await page.route('**/api/shop/orders/10', route => route.fulfill({json:{data:{id:10,status:cancelled?'cancelled':'pending',paymentType:'cash',total:90,items:[]}}}));
  await page.route('**/api/shop/orders/10/cancel', route => {
    cancelled = true;
    return route.fulfill({json:{data:{id:10,status:'cancelled'}}});
  });
  await page.goto('/shop/orders/10');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:'Отменить заказ',exact:true}).click();
  await expect(page.getByRole('button',{name:'Отменить заказ',exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Профиль',exact:true}).first().click();
  await expect(page.locator('.native-bonus-value')).toHaveText('135');
  expect(profileReads).toBeGreaterThan(1);
});

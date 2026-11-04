import {test,expect, type Locator} from '@playwright/test';

async function clickable(locator:Locator) {
  await expect(locator).toBeVisible();
  const metrics=await locator.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {width:r.width,height:r.height,left:r.left,right:r.right,viewport:innerWidth,hit:el===hit||el.contains(hit)};
  });
  expect(metrics.width).toBeGreaterThanOrEqual(43.5);
  expect(metrics.height).toBeGreaterThanOrEqual(43.5);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.hit).toBe(true);
}

test('banner boundary removes missing target while direct product keeps 404',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.home-banner:visible')).toHaveCount(1);
  await expect(page.locator('a[href="/product/3244"]')).toHaveCount(0);
  await page.locator('.home-banner:visible').click();
  await expect(page.locator('.product-detail h1:visible')).toContainText('Порция');
  const response=await page.goto('/product/3244');
  expect(response!.status()).toBe(404);
  await expect(page.getByText('Страница не найдена')).toBeVisible();
  await page.getByRole('link',{name:'В каталог'}).click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('cart and search fresh navigation starts at top and back restores scroll',async({page})=>{
  await page.goto('/search?query=салат');
  const result=page.locator('.product-card .product-title').last();
  await result.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>scrollY);
  expect(before).toBeGreaterThan(200);
  await result.click();
  await expect(page).toHaveURL(/\/product\/33/);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(5);
  await page.goBack();
  await expect(page).toHaveURL(/\/search/);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(200);
  await page.goto('/cart');
  await page.evaluate(()=>{document.querySelector('main')!.style.paddingTop='1200px';window.scrollTo(0,1000)});
  await page.getByRole('link',{name:'Перейти в каталог',exact:true}).first().click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(5);
});

test('phone and OTP states work with mocked responses, short viewport and keyboard',async({page})=>{
  let sends=0;
  await page.route('**/api/shop/auth/phone-login',async r=>{sends++;await new Promise(resolve=>setTimeout(resolve,100));await r.fulfill({json:{data:{codeLength:6}}});});
  await page.route('**/api/shop/auth/phone-confirm',r=>r.fulfill({status:422,json:{message:'Неверный тестовый код'}}));
  await page.setViewportSize({width:390,height:420});
  await page.goto('/profile');
  const trigger=page.getByRole('button',{name:'Войти по телефону'});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  const phone=dialog.getByLabel('Номер телефона');
  await expect(phone).toBeFocused();
  await phone.fill('+7 900');
  await dialog.getByRole('button',{name:'Получить код'}).click();
  await expect(dialog.getByRole('alert')).toContainText('номер');
  expect(sends).toBe(0);
  await phone.fill('8 (999) 123-45-67');
  const send=dialog.getByRole('button',{name:'Получить код'});
  const field=await phone.boundingBox();const button=await send.boundingBox();
  expect(button!.y-field!.y-field!.height).toBeGreaterThanOrEqual(15);
  await send.click();
  const otp=dialog.getByLabel('Код подтверждения');
  await expect(otp).toBeVisible();
  await otp.fill('12 34 56');
  await expect(otp).toHaveValue('123456');
  const login=dialog.getByRole('button',{name:'Войти',exact:true});
  await login.scrollIntoViewIfNeeded();await clickable(login);await login.click();
  await expect(dialog.getByRole('alert')).toContainText('Неверный тестовый код');
  await dialog.getByRole('button',{name:'Изменить номер',exact:true}).click();
  await expect(phone).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(sends).toBe(1);
});

test('mobile counters fit cards and desktop preview remains inside short viewport',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await page.goto('/search?query=салат');
  const card=page.locator('.product-card').first();
  await card.locator('.pill-buy-btn').click();
  const counter=card.locator('.pill-counter');
  const minus=counter.getByRole('button').first();const plus=counter.getByRole('button').last();
  await plus.scrollIntoViewIfNeeded();await clickable(plus);await plus.click();
  await clickable(minus);
  const boxes=await counter.evaluate(el=>{
    const r=el.getBoundingClientRect();return [...el.children].map(c=>{const b=c.getBoundingClientRect();return {left:b.left-r.left,right:b.right-r.right,top:b.top-r.top,bottom:b.bottom-r.bottom}});
  });
  for(const box of boxes){expect(box.left).toBeGreaterThanOrEqual(-1);expect(box.right).toBeLessThanOrEqual(1);expect(box.top).toBeGreaterThanOrEqual(-1);expect(box.bottom).toBeLessThanOrEqual(1);}
  await page.setViewportSize({width:1024,height:450});
  await page.goto('/');
  await page.locator('.cart-button').hover();
  const preview=page.locator('.cart-preview-popover');
  await expect(preview).toBeVisible();
  await preview.hover();
  await expect(preview).toBeVisible();
  const box=await preview.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(450);
  await expect(preview.getByRole('link',{name:'Перейти к оформлению'})).toHaveCount(0);
  await preview.getByRole('link',{name:'Открыть корзину'}).click();
  await expect(page).toHaveURL(/\/cart$/);
});

test('cold home inserts secondary content below the settled first screen without layout shifts',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).homeCls=0;
    new PerformanceObserver(list=>{for(const entry of list.getEntries() as any)if(!entry.hadRecentInput)(window as any).homeCls+=entry.value;}).observe({type:'layout-shift',buffered:true});
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.home-banner:visible')).toHaveCount(1);
  expect(await page.evaluate(()=>(window as any).homeCls)).toBeLessThan(0.1);
});

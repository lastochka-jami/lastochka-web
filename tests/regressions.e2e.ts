import { test, expect } from '@playwright/test';

const item = {id:-10,quantity:200,price:47.8,product:{id:10,storeId:2,title:'Порция 200 г',price:47.8,quantityStep:200,measurementUnit:'gram',measurementUnitLabel:'г',stockQuantity:10000,images:[],supplements:[]},supplements:[]};
const cart = {storeGroups:[{store:{id:2,name:'Тестовый магазин',isPickupEnabled:true},items:[item]}]};

test('filled guest cart can be viewed and edited at 320, 390, 768 and 1440 without overflow', async ({page}) => {
  test.setTimeout(120_000);
  await page.addInitScript(value => localStorage.setItem('lastochka_guest_cart_v1', JSON.stringify(value)),cart);
  for (const width of [320,390,464,767,768,769,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/shop/cart');
    const row = page.locator('.cart-item-row');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.cart-item-bold-price')).toContainText('47,80');
    await row.getByRole('button',{name:'Увеличить',exact:true}).click();
    await expect(row.locator('.cart-item-stepper-val')).toContainText('400');
    await expect(row.locator('.cart-item-bold-price')).toContainText('95,60');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('.float-actions')).toBeHidden();
    await expect(page.locator('.cart-main-cta-btn:visible')).toBeDisabled();
    const geometry = await row.evaluate(el => {
      const selectors=['.cart-item-thumb','.cart-item-middle','.cart-item-right'];
      const rects=selectors.map(s=>el.querySelector(s)!.getBoundingClientRect());
      const buttons=[...el.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {w:r.width,h:r.height,left:r.left,right:r.right,hit:b===hit||b.contains(hit)}});
      const overlap=rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
      return {overlap,buttons,viewport:innerWidth};
    });
    expect(geometry.overlap).toBe(false);
    for(const button of geometry.buttons){expect(button.w).toBeGreaterThanOrEqual(44);expect(button.h).toBeGreaterThanOrEqual(44);expect(button.left).toBeGreaterThanOrEqual(0);expect(button.right).toBeLessThanOrEqual(geometry.viewport);expect(button.hit).toBe(true);}

    await page.screenshot({path:`test-results/cart-${width}.png`,fullPage:true});
  }
});

test('mobile product actions remain clickable after adding a portion', async ({page}) => {
  test.setTimeout(120_000);
  for(const width of [320,390,464,767,768,769,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/shop/product/10');
    await page.evaluate(() => localStorage.removeItem('lastochka_guest_cart_v1'));
    await page.reload();
    await expect(page.locator('.product-detail h1:visible')).toBeVisible();
    const add = page.locator('.mobile-product-buy-bar .add-button:visible, .detail-buy .add-button:visible').first();
    await expect(add).toBeVisible();
    await add.click();
    const counter = page.locator('.mobile-product-buy-bar .counter:visible, .detail-buy .counter:visible').first();
    const plus = counter.getByRole('button').last();
    await expect(plus).toBeVisible();
    await plus.click();
    await expect(plus).toBeEnabled();
    await expect(page.locator('.float-actions')).toBeHidden();
    const box = await counter.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`test-results/product-${width}.png`,fullPage:true});
  }
});

test('shared import adds exact quantity once and survives reload without duplicates', async ({page}) => {
  const link='v2.'+encodeURIComponent(JSON.stringify({version:2,items:[{id:10,storeId:2,quantity:200,supplements:[]}]}));
  await page.goto('/shop/share-cart#'+link);
  await page.getByRole('button',{name:'Добавить всё в корзину'}).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.locator('.cart-item-stepper-val')).toContainText('200');
  await page.goto('/shop/share-cart#'+link);
  await page.getByRole('button',{name:'Добавить всё в корзину'}).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.locator('.cart-item-stepper-val')).toContainText('200');
});

test('network errors show retry and stale slot responses cannot replace a new date', async ({page}) => {
  await page.route('**/api/shop/**',r=>r.fulfill({json:{data:[]}}));
  await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/cart**',r=>r.fulfill({json:{data:cart}}));
  await page.route('**/api/shop/addresses',r=>r.fulfill({json:{data:[{id:1,city:'Город',street:'Улица',houseNumber:'1',isActive:true}]}}));
  let fail=true;
  await page.route('**/*delivery-slots?**',async r=>{
    if(fail) return r.fulfill({status:500,json:{message:'Тестовая ошибка интервалов'}});
    const date=new URL(r.request().url()).searchParams.get('date');
    await new Promise(resolve=>setTimeout(resolve,date==='2026-11-10'?250:20));
    await r.fulfill({json:{data:{slots:[{id:date==='2026-11-10'?10:11,timeSlot:date==='2026-11-10'?'Старый интервал':'Новый интервал'}],availablePaymentMethods:['cash']}}});
  });
  await page.goto('/shop/cart');
  await expect(page.getByText('Тестовая ошибка интервалов')).toBeVisible();
  fail=false;
  await page.getByRole('button',{name:'Попробовать ещё раз'}).click();
  await expect(page.getByText('Тестовая ошибка интервалов')).toHaveCount(0);
  await page.locator('.cart-time-banner').click();
  const date=page.locator('input[type=date]');
  await date.fill('2026-11-10');
  await date.fill('2026-11-11');
  await expect(page.locator('select option').filter({hasText:'Новый интервал'})).toHaveCount(1);
  await page.waitForTimeout(350);
  await expect(page.locator('select option').filter({hasText:'Старый интервал'})).toHaveCount(0);
});

test('loyalty uses 100 whole bonuses and never fabricates a pending-card QR', async ({page}) => {
  await page.route('**/api/shop/**',r=>r.fulfill({json:{data:[]}}));
  await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/cart**',r=>r.fulfill({json:{data:cart}}));
  await page.route('**/api/shop/bonuses?**',r=>r.fulfill({json:{data:[{id:1,amount:100,description:'Тестовое начисление'}]}}));
  await page.route('**/api/shop/loyalty-card',r=>r.fulfill({json:{data:{status:'pending',balance:100}}}));
  await page.goto('/shop/bonuses');
  await expect(page.locator('.loyalty-number-text')).toHaveText('100');
  await page.getByRole('button',{name:'QR-код карты постоянного покупателя'}).click();
  await expect(page.getByText('Карта готовится. QR-код появится после подтверждения магазином.')).toBeVisible();
  await expect(page.locator('img[src^="data:image"]')).toHaveCount(0);
  await expect(page.getByText('+100', {exact:true})).toBeVisible();
});

test('address editor has one form and cannot save unconfirmed default coordinates', async ({page}) => {
  await page.route('**/api/shop/**',r=>r.fulfill({json:{data:[]}}));
  await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/cart**',r=>r.fulfill({json:{data:cart}}));
  await page.route('**/api/shop/addresses',r=>r.fulfill({json:{data:[]}}));
  await page.goto('/shop/addresses');
  await page.getByRole('button',{name:'Добавить адрес',exact:true}).click();
  await expect(page.locator('form form')).toHaveCount(0);
  await expect(page.getByText('Выберите точку с помощью поиска или геолокации, чтобы увидеть её на карте.')).toBeVisible();
  await expect(page.locator('.osm-iframe')).toHaveCount(0);
});

test('an empty server cart still offers retry for retained guest items', async ({page}) => {
  await page.addInitScript(value=>localStorage.setItem('lastochka_guest_cart_v1',JSON.stringify(value)),cart);
  await page.route('**/api/shop/**',r=>r.fulfill({json:{data:[]}}));
  await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false,publicOrigin:'http://127.0.0.1:3011'}}));
  await page.route('**/api/shop/cart',r=>r.fulfill({json:{data:{storeGroups:[]}}}));
  await page.route('**/api/shop/cart?**',r=>r.fulfill({json:{data:{storeGroups:[]}}}));
  let rejected=true;
  await page.route('**/api/shop/cart/items',r=>r.fulfill({status:rejected?422:200,json:{message:rejected?'Нет в наличии':'OK'}}));
  await page.goto('/shop/cart');
  const retry=page.getByRole('button',{name:'Повторить перенос сохранённых товаров'});
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page.locator('.toast')).toContainText('Перенесено: 0');
  await expect(retry).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lastochka_guest_cart_v1')!).storeGroups[0].items.length)).toBe(1);
  rejected=false;
  await retry.click();
  await expect(retry).toHaveCount(0);
});

test('home, catalog and search fit all required widths with controlled API data', async ({page}) => {
  test.setTimeout(120_000);
  const errors:string[]=[];
  page.on('pageerror', e=>errors.push(e.message));
  for (const width of [320,390,464,767,768,769,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:900});
    for (const path of ['/','/catalog','/search?query=салат']) {
      await page.goto('/shop' + path,{waitUntil:'networkidle'});
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main h1')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${path} at ${width}`).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
});

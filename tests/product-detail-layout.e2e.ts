import {test,expect} from '@playwright/test';
test('product opens over search and closes back to the same results',async({page})=>{
  for(const width of [320,390,767,768,1023,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:844});
    await page.goto('/shop/search?query=порция');
    const url=page.url();
    const link=page.locator('.product-title').first();
    await link.click();
    const modal=page.locator('dialog.product-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h1')).toBeVisible();
    if(width<768){
      await expect.poll(()=>modal.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return Math.max(Math.abs(rect.left),Math.abs(innerWidth-rect.right));
      })).toBeLessThanOrEqual(1);
    }
    expect(page.url()).toBe(url);
    await expect(modal).not.toContainText('В наличии');
    await expect(modal).not.toContainText('Открыть страницу товара');
    await page.screenshot({path:`test-results/product-modal-${width}.png`});
    const buy=modal.locator('.detail-buy .add-button');
    await buy.scrollIntoViewIfNeeded();
    await buy.click();
    await expect(modal.locator('.detail-buy .counter')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(link).toBeFocused();
    await page.evaluate(()=>localStorage.removeItem('lastochka_guest_cart_v1'));
  }
});
test('shared product URL also opens a closable card over catalog',async({page})=>{
  await page.goto('/shop/product/10');
  const modal=page.locator('dialog.product-modal');
  await expect(modal.locator('h1')).toBeVisible();
  await modal.getByRole('button',{name:'Закрыть',exact:true}).click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('close control stays fully inside a scrolled product dialog', async ({page}) => {
  await page.route('**/api/shop/products/10?**', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.description = 'Подробное описание продукта. '.repeat(100);
    body.data.composition = 'Мука, вода, соль.';
    body.data.proteins = 7.97;
    body.data.fats = 1.68;
    body.data.carbohydrates = 55.26;
    body.data.calories = 268.04;
    await route.fulfill({json: body});
  });
  for (const width of [320,390,767,768,1023,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:568});
    await page.goto('/shop/product/10');
    const modal = page.locator('dialog.product-modal');
    await expect(modal.locator('.nutrition')).toBeVisible();
    await modal.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const close = modal.getByRole('button', {name:'Закрыть',exact:true});
    const geometry = await close.evaluate(el => {
      const r = el.getBoundingClientRect();
      const dialog = el.closest('dialog')!.getBoundingClientRect();
      const heading = el.closest('dialog')!.querySelector('.modal-heading')!;
      const h = heading.getBoundingClientRect();
      const headerOnTop = Array.from({length:Math.floor(h.width/22)-1}, (_,i) => h.left+(i+1)*22)
        .every(x => { const hit = document.elementFromPoint(x,h.top+h.height/2); return hit === heading || heading.contains(hit); });
      const points = [[r.left+r.width/2,r.top+4],[r.left+r.width/2,r.bottom-4],[r.left+4,r.top+r.height/2],[r.right-4,r.top+r.height/2]];
      return {
        top:r.top, dialogTop:dialog.top, bottom:r.bottom, dialogBottom:dialog.bottom, headerOnTop,
        reachable:points.every(([x,y]) => { const hit = document.elementFromPoint(x,y); return hit === el || el.contains(hit); }),
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.dialogTop);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.dialogBottom);
    expect(geometry.reachable).toBe(true);
    expect(geometry.headerOnTop).toBe(true);
    await page.screenshot({path:`test-results/product-dialog-scrolled-${width}.png`,animations:'disabled'});
    await close.click();
    await expect(modal).toHaveCount(0);
  }
});

test('empty account lists expose one add action and a reachable dialog close', async ({page}) => {
  await page.route('**/api/shop/**', r => r.fulfill({json:{data:[]}}));
  await page.route('**/api/session', r => r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false}}));
  await page.route('**/api/shop/addresses', r => r.fulfill({json:{data:[]}}));
  await page.route('**/api/shop/payment-cards', r => r.fulfill({json:{data:[]}}));
  for (const width of [320,1440]) {
    await page.setViewportSize({width,height:568});
    for (const [path,label] of [['addresses','Добавить адрес'],['cards','Привязать карту']]) {
      await page.goto('/shop/' + path);
      await expect(page.getByText(/У вас пока нет сохранённых/)).toBeVisible();
      const add = page.getByRole('button',{name:label,exact:true});
      await expect(add).toHaveCount(1);
      await add.click();
      const modal = page.getByRole('dialog');
      await modal.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
      await modal.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const close = modal.getByRole('button',{name:'Закрыть',exact:true});
      await expect.poll(() => close.evaluate(el => {
        const r = el.getBoundingClientRect();
        const d = el.closest('dialog')!.getBoundingClientRect();
        return r.top >= d.top && r.bottom <= d.bottom;
      })).toBe(true);
      await close.click();
      await expect(modal).toHaveCount(0);
    }
  }
});

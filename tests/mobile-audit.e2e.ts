import {test, expect} from '@playwright/test';

test('profile has one mobile title, real addresses, whole bonuses and reachable actions', async ({page}) => {
  await page.route('**/api/session', r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false}}));
  await page.route('**/api/shop/**', r=>r.fulfill({json:{data:[]}}));
  await page.route('**/api/shop/auth/profile', r=>r.fulfill({json:{data:{phone:'+79990000000'}}}));
  await page.route('**/api/shop/loyalty-card', r=>r.fulfill({json:{data:{balance:100}}}));
  await page.route('**/api/shop/addresses', r=>r.fulfill({json:{data:[{id:1,street:'Тестовая'}]}}));
  await page.route('**/api/shop/cart*', r=>r.fulfill({json:{data:{storeGroups:[{store:{id:2},items:[{id:1,quantity:1,price:100,product:{id:10,title:'Товар',price:100}}]}]}}}));
  for (const width of [320,390,430,767,1440]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/shop/profile');
    await expect(page.locator('.native-bonus-value')).toHaveText('100');
    await expect(page.getByText('Сохранённых адресов: 1')).toBeVisible();
    await expect(page.getByText('Нет адресов доставки')).toHaveCount(0);
    if(width<768) await expect(page.locator('.mobile-app-bar')).toBeHidden();
    const add=page.getByRole('link',{name:'Добавить адрес доставки',exact:true});
    await add.scrollIntoViewIfNeeded();
    expect(await add.evaluate(el=>{
      const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return r.width>=44&&r.height>=44&&(el===hit||el.contains(hit));
    })).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`test-results/mobile-audit-profile-${width}.png`,fullPage:true});
  }
});

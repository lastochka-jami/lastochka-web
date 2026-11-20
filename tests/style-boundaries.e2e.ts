import {test,expect} from '@playwright/test';

test('form controls retain their geometry, mobile text size and keyboard focus', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/shop/**', r => r.fulfill({json:{data:[]}}));
  await page.route('**/api/session', r => r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false}}));
  await page.route('**/api/shop/auth/profile', r => r.fulfill({json:{data:{id:1,phone:'+79990000000',bonusBalance:125}}}));
  await page.route('**/api/shop/users/me/notification-settings', r => r.fulfill({json:{data:{ordersEnabled:true}}}));
  for (const width of [320,390,767,768,1023,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/shop/profile/settings');
    const input = page.locator('.settings-form input').first();
    await expect(input).toBeVisible();
    if (width < 768) expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await input.focus();
    expect(await input.evaluate(el => {
      const s = getComputedStyle(el);
      return el.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    })).toBe(true);
    const checks = page.locator('.check input[type=checkbox]');
    for (const checkbox of await checks.all()) {
      const r = await checkbox.boundingBox();
      expect(Math.abs(r!.width-r!.height)).toBeLessThanOrEqual(1);
      expect(r!.width).toBeLessThan(30);
      const label = await checkbox.locator('..').boundingBox();
      expect(label!.height).toBeGreaterThanOrEqual(44);
    }
    if (width >= 768 && width < 1024) {
      const gap = await page.locator('.bottom-nav').evaluate(el => {
        const r = el.getBoundingClientRect();
        const last = el.lastElementChild!.getBoundingClientRect();
        return r.right-parseFloat(getComputedStyle(el).paddingRight)-last.right;
      });
      expect(Math.abs(gap)).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/shop/addresses');
  await page.getByRole('button',{name:'Добавить адрес',exact:true}).click();
  const modal = page.getByRole('dialog');
  await modal.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  const checkbox = modal.getByRole('checkbox');
  const geometry = await checkbox.evaluate(el => {
    const r = el.getBoundingClientRect();
    return {width:r.width,height:r.height,labelHeight:el.closest('label')!.getBoundingClientRect().height};
  });
  expect(Math.abs(geometry.width-geometry.height)).toBeLessThanOrEqual(1);
  expect(geometry.width).toBeLessThan(30);
  expect(geometry.labelHeight).toBeGreaterThanOrEqual(44);
  expect(await modal.locator('input[name=city]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});

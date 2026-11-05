import {test,expect} from '@playwright/test';
test('product opens over search and closes back to the same results',async({page})=>{
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/shop/search?query=порция');
    const url=page.url();
    const link=page.locator('.product-title').first();
    await link.click();
    const modal=page.locator('dialog.product-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h1')).toBeVisible();
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

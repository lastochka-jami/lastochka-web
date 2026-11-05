import {test,expect} from '@playwright/test';
test('detail gallery actions do not overlap and title and purchase fit',async({page})=>{
  for(const width of [320,390,767,768,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/shop/product/10');
    await expect(page.locator('.product-detail h1')).toBeVisible();
    const favorite=page.locator('.gallery .favorite');
    const share=page.getByRole('button',{name:'Поделиться товаром'});
    for(const button of [favorite,share]){
      await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(el=>{
        const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return r.width>=44&&r.height>=44&&(hit===el||el.contains(hit));
      })).toBe(true);
    }
    if(width<768){
      await expect(page.locator('.header')).toBeHidden();
      await expect(page.locator('.bottom-nav')).toBeHidden();
      const title=await page.locator('.product-detail h1').boundingBox();
      const buy=await page.locator('.mobile-product-buy-bar').boundingBox();
      expect(title!.y + title!.height).toBeLessThan(buy!.y);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`test-results/product-detail-layout-${width}.png`,fullPage:true});
  }
});

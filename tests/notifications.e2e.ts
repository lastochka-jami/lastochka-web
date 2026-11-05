import {test,expect} from '@playwright/test';
test('notifications render previews and readable details and support reading',async({page})=>{
  const body=JSON.stringify({time:1,blocks:[{type:'paragraph',data:{text:'&nbsp; Полный <b>текст</b> &mdash; без JSON.'}}],version:'2.29.1'});
  let read=false;
  await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false}}));
  await page.route('**/api/shop/**',async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path.endsWith('/notifications/read-all')||path.endsWith('/notifications/1/read')){read=true;return r.fulfill({json:{data:{}}});}
    const n={id:1,title:'Мамины руки для объятий!',shortDescription:'Пакеты привезёт «Ласточка».',body,createdAt:'2026-10-28T10:14:00+03:00',isRead:read};
    return r.fulfill({json:{data:path.endsWith('/notifications/1')?n:path.endsWith('/notifications')?[n]:[]}});
  });
  await page.goto('/shop/notifications');
  await expect(page.locator('.notif-preview')).toHaveText('Пакеты привезёт «Ласточка».');
  await expect(page.locator('.notification-day')).toContainText('28 октября');
  await expect(page.locator('.notification-item')).not.toContainText('blocks');
  await page.locator('.notification-item').click();
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('.notification-detail-text')).toHaveText('Полный текст — без JSON.');
  await page.keyboard.press('Escape');
  await expect(page.locator('.notification-item.unread')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Прочитать все уведомления'})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:'test-results/notifications-'+test.info().project.name+'.png',fullPage:true});
});

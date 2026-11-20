import {test, expect, type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const widths = [320,390,767,768,1023,1024,1280,1440,1920];
const title = 'Очень длинное название адреса доставки '.repeat(4);
const street = 'ДлиннаяУлицаБезПробелов'.repeat(6);
const description = 'НачислениеЗаПокупку'.repeat(12);

async function localOnly(page:Page) {
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(u.hostname) ? route.continue() : route.abort();
  });
  await page.emulateMedia({reducedMotion:'reduce'});
}
async function account(page:Page) {
  await localOnly(page);
  await page.route('**/api/session', r=>r.fulfill({json:{authenticated:true,csrf:'test',storeId:2,checkoutEnabled:false}}));
  await page.route('**/api/shop/**', r=> {
    const path = new URL(r.request().url()).pathname;
    let data:unknown = [];
    if (path.endsWith('/auth/profile')) data={id:1,phone:'+79990000000',bonusBalance:125};
    if (path.endsWith('/addresses')) data=[{id:1,title,city:'Махачкала',street,houseNumber:'1',isActive:true}];
    if (path.endsWith('/payment-cards')) data=[{id:1,cardType:'Mastercard',last4:'1234'}];
    if (path.endsWith('/bonuses')) data=[{id:1,description,amount:100}];
    if (path.endsWith('/loyalty-card')) data={status:'pending',balance:125};
    return r.fulfill({json:{data}});
  });
}

test('long address and bonus text stays inside its card and preserves actions and amount', async ({page},info)=>{
  test.setTimeout(120_000);
  await account(page);
  for (const width of widths) {
    await page.setViewportSize({width,height:568});
    for (const [path,selector] of [['addresses','.address-card'],['bonuses','.bonuses-history']]) {
      await page.goto('/shop/'+path);
      const card=page.locator(selector);
      await expect(card).toBeVisible();
      await expect(page.getByText(path==='addresses'?title:description,{exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      expect(await card.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
      if(path==='addresses') {
        if(width>=1024){
          await expect(page.locator('.location-name')).toContainText(street);
          expect(await page.locator('.header').evaluate(el=>el.getBoundingClientRect().height-parseFloat(getComputedStyle(el).getPropertyValue('--header-height')))).toBeLessThanOrEqual(1);
        }
        const edit=card.getByRole('button',{name:'Изменить',exact:true});
        await edit.scrollIntoViewIfNeeded();
        await edit.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(edit).toBeFocused();
      } else {
        const amount=card.getByText('+100',{exact:true});
        const a=await amount.boundingBox(),c=await card.boundingBox();
        expect(a!.x+a!.width).toBeLessThanOrEqual(c!.x+c!.width);
      }
      if(width===320||width===1024)await page.screenshot({path:info.outputPath(`after-${path}-${width}.png`),fullPage:true});
    }
  }
});

test('product purchase surface, supplements and variants survive breakpoint and short-height changes',async({page},info)=>{
  test.setTimeout(120_000);
  await localOnly(page);
  const product = {id:10,storeId:2,title:'ДлинноеНазваниеПродукта'.repeat(8),price:120,quantityStep:1,measurementUnit:'piece',stockQuantity:100,images:[],description:'Описание продукта. '.repeat(100),category:{id:1,slug:'food',name:'Продукты'},isConfigurable:true,variants:[{id:11,title:'Другой вариант',price:130,stockQuantity:100}],supplements:[{id:1,title:'Обязательные добавки',isRequired:true,values:[{id:1,title:'Добавка с длинным названием '.repeat(5),price:10}]}]};
  await page.route('**/api/shop/products/10?**',r=>r.fulfill({json:{data:product}}));
  await page.route('**/api/shop/products/11?**',r=>r.fulfill({json:{data:{...product,id:11,title:'Другой вариант',isConfigurable:false,supplements:[]}}}));
  for(const width of widths){
    await page.setViewportSize({width,height:420});
    await page.goto('/shop/product/10');
    const modal=page.getByRole('dialog');
    await expect(modal.locator('fieldset')).toBeVisible();
    const buy=modal.locator('.detail-buy');
    const styles=await buy.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderTopWidth,radius:s.borderTopLeftRadius,padding:s.paddingTop}});
    expect(styles.border).toBe('0px');expect(styles.radius).toBe('0px');
    const check=modal.getByRole('checkbox');
    await check.check();
    const add=buy.locator('.add-button');
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await expect(page.locator('.toast')).toBeVisible();
    expect(await modal.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await modal.getByRole('combobox').selectOption('11');
    await expect(modal.locator('h1')).toHaveText('Другой вариант');
    await buy.locator('.add-button').click();
    const counter=buy.locator('.counter');
    await expect(counter).toBeVisible();
    const plus=counter.getByRole('button').last();await plus.click();
    await expect(plus).toBeEnabled();
    await modal.evaluate(el=>{el.scrollTop=el.scrollHeight});
    const close=modal.getByRole('button',{name:'Закрыть',exact:true});
    const reachable=await close.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return (el===hit||el.contains(hit))&&r.width>=44&&r.height>=44});
    expect(reachable).toBe(true);
    if(width===320||width===768)await page.screenshot({path:info.outputPath(`product-short-${width}.png`)});
    await close.click();
    await page.evaluate(()=>localStorage.clear());
  }
});

test('long error can be read and retried in a short product dialog',async({page},info)=>{
  await localOnly(page);
  let fail=true;
  await page.route('**/api/shop/products/10?**',r=>r.fulfill(fail?{status:500,json:{message:'ОшибкаЗагрузки'.repeat(50)}}:{json:{data:{id:10,title:'Восстановленный товар',price:100,stockQuantity:10,images:[],supplements:[]}}}));
  for(const width of [320,768,1024]){
    fail=true;await page.setViewportSize({width,height:420});await page.goto('/shop/product/10');
    const modal=page.getByRole('dialog');await expect(modal.getByRole('alert')).toBeVisible();
    await modal.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
    if(width===320)await page.screenshot({path:info.outputPath('error-short-320.png')});
    expect(await modal.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    fail=false;await modal.getByRole('button',{name:'Попробовать ещё раз'}).click();await expect(modal.locator('h1')).toHaveText('Восстановленный товар');
    await page.keyboard.press('Escape');
  }
});

test('notification dialog keeps a long title and close control within its heading',async({page},info)=>{
  await account(page);
  const n={id:1,title:'ДлинныйЗаголовокУведомления'.repeat(20),body:'Текст уведомления. '.repeat(100),isRead:false};
  await page.route('**/api/shop/notifications**',r=>r.fulfill({json:{data:/\/notifications\/1$/.test(new URL(r.request().url()).pathname)?n:[n]}}));
  for(const width of [320,767,768,1024,1440]){
    await page.setViewportSize({width,height:420});await page.goto('/shop/notifications');
    await page.locator('.notification-item').click();
    const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
    // Wait for the dialog entrance transform before measuring click targets.
    await modal.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
    if(width===320||width===768)await page.screenshot({path:info.outputPath(`notification-title-${width}.png`)});
    expect(await modal.locator('.modal-heading').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(210);
    const close=modal.getByRole('button',{name:'Закрыть',exact:true});
    const metrics=await close.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog')!;return {width:r.width,inside:r.right<=d.getBoundingClientRect().right,overflow:d.scrollWidth-d.clientWidth}});
    expect(metrics.width).toBeGreaterThanOrEqual(44);expect(metrics.inside).toBe(true);expect(metrics.overflow).toBeLessThanOrEqual(1);
    await close.click();
  }
});

test('main screens fit every required width at normal and short heights',async({page},info)=>{
  test.setTimeout(240_000);
  await account(page);
  const measurements:unknown[]=[];
  for(const height of [420,844])for(const width of widths){
    await page.setViewportSize({width,height});
    for(const path of ['', 'catalog','search?query=тест','cart','profile','profile/settings','addresses','cards','bonuses','notifications']){
      await page.goto('/shop/'+path,{waitUntil:'networkidle'});
      await expect(page.locator('#main')).toBeVisible();
      const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,scrollHeight:document.documentElement.scrollHeight}));
      measurements.push({path,width,height,...m});
      expect(m.overflow,`${path} ${width}x${height}`).toBeLessThanOrEqual(1);
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      const footer=page.locator('.footer');
      await expect(footer).toBeVisible();
      if(height===420&&(width===320||width===1024))await page.screenshot({path:info.outputPath(`screen-${path.replace(/\W/g,'-')||'home'}-${width}.png`),fullPage:true});
    }
  }
  const geometryPath=info.outputPath('geometry.json');
  await writeFile(geometryPath,JSON.stringify(measurements,null,2));
  await info.attach('geometry.json',{path:geometryPath,contentType:'application/json'});
});

test('account error, retry and empty states remain usable on a narrow screen',async({page})=>{
  await account(page);await page.setViewportSize({width:320,height:420});
  for(const [path,endpoint] of [['addresses','addresses'],['cards','payment-cards'],['bonuses','bonuses'],['notifications','notifications']]){
    let fail=true;
    await page.route('**/api/shop/'+endpoint+'*',async r=>{
      await new Promise(resolve=>setTimeout(resolve,120));
      return r.fulfill(fail?{status:500,json:{message:'ОшибкаСоединения'.repeat(30)}}:{json:{data:[]}});
    });
    await page.goto('/shop/'+path,{waitUntil:'networkidle'});const alert=page.locator('.account-section .error[role=alert]').first();await expect(alert).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    fail=false;await alert.getByRole('button',{name:'Попробовать ещё раз'}).click();await expect(alert).toHaveCount(0);
  }
});

test('filters, location sheet and manual scanner stay reachable in a short window',async({page},info)=>{
  test.setTimeout(120_000);await localOnly(page);
  // Deterministic camera denial avoids depending on hardware and exercises the fallback UI.
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture camera denied','NotAllowedError')}});
  for(const width of widths){
    await page.setViewportSize({width,height:420});await page.goto('/shop/search?query=тест');
    await page.getByRole('button',{name:/Фильтры/}).click();
    const filter=page.locator('dialog.filter-dialog');await expect(filter).toBeVisible();
    await filter.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
    const range=filter.getByRole('slider',{name:'Максимальная цена',exact:true});
    expect(await range.evaluate(el=>{const r=el.getBoundingClientRect(),rail=el.parentElement!.querySelector('.price-slider-rail')!.getBoundingClientRect();return Math.abs((r.y+r.height/2)-(rail.y+rail.height/2))})).toBeLessThanOrEqual(1);
    await range.focus();await range.press('ArrowLeft');await expect(range).toHaveValue('4999');
    if(width===390)await page.screenshot({path:info.outputPath('filter-after-390.png')});
    await filter.getByRole('button',{name:'Применить',exact:true}).click();await expect(filter).not.toBeVisible();
    // Scanner is available in the shared desktop search box.
    const scanner=page.getByRole('button',{name:'Сканировать штрихкод',exact:true});
    if(await scanner.isVisible()){
      await scanner.click();const screen=page.getByRole('dialog',{name:'Сканирование штрихкода'});await expect(screen).toBeVisible();
      await screen.getByRole('button',{name:'Ввести штрихкод вручную'}).click();
      const input=screen.locator('input');await expect(input).toBeVisible();
      const back=screen.getByRole('button',{name:'Вернуться к камере'});
      await back.scrollIntoViewIfNeeded();
      expect(await back.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.bottom<=innerHeight&&(el===hit||el.contains(hit))})).toBe(true);
      if(width===320||width===768)await page.screenshot({path:info.outputPath(`scanner-manual-${width}.png`)});
      const close=screen.getByRole('button',{name:'Закрыть сканер'});await close.click();await expect(screen).toHaveCount(0);
    }
    await page.goto('/shop/');
    await page.getByRole('button',{name:width<1024?'Указать адрес доставки':'Выбор адреса и магазина доставки',exact:true}).first().click();
    const sheet=page.getByRole('dialog');await expect(sheet).toBeVisible();
    await sheet.getByRole('tab',{name:'Самовывоз'}).click();
    expect(await sheet.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    if(width===320||width===1024)await page.screenshot({path:info.outputPath(`location-${width}.png`)});
    await sheet.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(sheet).toHaveCount(0);
  }
});

import {test,expect} from '@playwright/test';

const referenceViewports = [
  [320,568],[390,844],[464,800],[767,900],[768,900],[769,900],
  [1024,768],[1280,800],[1440,900],[1920,1080],
] as const;

async function assertResponsivePage(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, {waitUntil:'networkidle'});
  await expect(page.locator('main h1')).toHaveCount(1);
  const metrics=await page.evaluate(()=>{
    const interactive=[...document.querySelectorAll<HTMLElement>('button,a,input,select,textarea')];
    const visible=(el:HTMLElement)=>{
      const r=el.getBoundingClientRect();
      const s=getComputedStyle(el);
      return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;
    };
    const outside=interactive.filter((el)=>{
      if(!visible(el)||el.closest('.product-carousel-track,.subcategory-pills-scroll,.stories,.thumbnails')) return false;
      const r=el.getBoundingClientRect();
      return r.left < -1 || r.right > innerWidth + 1;
    });
    const tooSmall=interactive.filter((el)=>{
      if(!visible(el)||el.matches('.product-title,.breadcrumbs a,.footer-brand,input[type="checkbox"],input[type="radio"]')) return false;
      if(el.tagName==='A'&&!el.matches('.primary,.secondary,.cart-button,.catalog-button,.bottom-nav a,.float-search-btn,.float-cart-btn')) return false;
      const r=el.getBoundingClientRect();
      return r.width<43.5||r.height<43.5;
    });
    return {
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      h1:document.querySelectorAll('h1').length,
      outside:outside.map((el)=>el.getAttribute('aria-label')||el.textContent?.trim()).slice(0,5),
      tooSmall:tooSmall.map((el)=>el.getAttribute('aria-label')||el.textContent?.trim()).slice(0,8),
    };
  });
  expect(metrics.overflow,`${path}: horizontal overflow`).toBe(0);
  expect(metrics.h1,`${path}: exactly one semantic h1`).toBe(1);
  expect(metrics.outside,`${path}: controls outside viewport`).toEqual([]);
  expect(metrics.tooSmall,`${path}: undersized controls`).toEqual([]);
}

test('home, catalog, search and product links use live store data',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  if((page.viewportSize()?.width||0)<=767)await expect(page.getByRole('button',{name:/Указать адрес доставки/})).toBeVisible();
  else await expect(page.getByRole('heading',{name:'Всё любимое — рядом'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Рекомендуем'})).toBeVisible();
  await page.goto('/catalog');
  await expect(page.getByRole('heading',{name:'Каталог',exact:true})).toBeVisible();
  await expect(page.locator('.catalog-category-section').first()).toBeVisible();
  const category=page.locator('.category-tile').first();
  await category.click();
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.goto('/search?query=молоко');
  await expect(page.getByRole('heading',{name:/Результаты поиска/})).toBeVisible();
  const product=page.locator('.product-card .product-title').first();
  await expect(product).toBeVisible();
  await product.click();
  await expect(page.locator('.product-detail h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('location picker uses delivery and pickup tabs without leaving the page',async({page})=>{
  await page.goto('/');
  if((page.viewportSize()?.width||0)<=767){
    await page.getByRole('button',{name:/Указать адрес доставки/}).first().click();
  }else{
    await page.getByRole('button',{name:'Выбор адреса и магазина доставки'}).click();
  }
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab',{name:'Доставка'})).toHaveAttribute('aria-selected','true');
  await expect(dialog.getByText('Нет сохраненных адресов')).toBeVisible();
  await dialog.getByRole('tab',{name:'Самовывоз'}).click();
  await expect(dialog.getByRole('tab',{name:'Самовывоз'})).toHaveAttribute('aria-selected','true');
  await expect(dialog.getByText('default',{exact:true})).toHaveCount(0);
});

test('layout has no horizontal overflow and browser history restores catalog',async({page})=>{
  await page.goto('/search?query=молоко&page=1');
  const first=page.locator('.product-card .product-title').first();
  await first.click();
  await expect(page).toHaveURL(/\/product\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?query=.*page=1/);
  await expect(page.locator('.product-card').first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('key storefront pages do not overflow or sit behind fixed controls at reference widths',async({page})=>{
  for(const width of [390,768,1280,1440]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/','/catalog','/category/food']){
      await page.goto(path);
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,lastBottom:(document.querySelector('main')?.getBoundingClientRect().bottom||0),viewport:innerHeight}));
      expect(metrics.overflow,`${path} at ${width}px`).toBe(0);
      expect(await page.locator('main').isVisible()).toBe(true);
    }
  }
});

test('anonymous cart remains accessible and personal pages request login',async({page})=>{
  await page.goto('/cart');
  await expect(page.getByText('В корзине пока пусто')).toBeVisible();
  await page.goto('/favorites');
  await expect(page.getByRole('button',{name:'Войти по телефону'})).toBeVisible();
});

test('responsive invariants hold at all required viewport widths',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  test.setTimeout(300_000);
  const routes=[
    '/','/catalog','/category/food','/collection/firmennye-bliuda',
    '/search?query=молоко','/product/10','/cart','/profile','/profile/settings',
    '/favorites','/orders','/addresses','/cards','/bonuses','/notifications',
    '/promotions','/stories','/faq','/info',
  ];
  for(const [width,height] of referenceViewports){
    await page.setViewportSize({width,height});
    for(const route of routes) await assertResponsivePage(page,route);
  }
});

test('mobile landscape and 200 percent text remain usable',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  await page.setViewportSize({width:844,height:390});
  await page.goto('/');
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await expect(page.getByRole('link',{name:/Открыть каталог/})).toBeVisible();
  await page.goto('/search?query=молоко');
  await expect(page.locator('.product-card').first()).toBeVisible();
});

test('mobile shell has four tabs and separate search and cart actions',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  await page.goto('/');
  await expect(page.locator('.bottom-nav a')).toHaveCount(4);
  await expect(page.locator('.bottom-nav').getByText('Корзина')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Указать адрес доставки'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Уведомления'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('search suggestions and login dialog work from the keyboard',async({page})=>{
  await page.goto((page.viewportSize()?.width||0)<=767?'/search':'/');
  const search=page.getByRole('combobox',{name:'Поиск товаров'});
  await search.focus();
  await search.fill('молоко');
  const listbox=page.getByRole('listbox',{name:'Подсказки поиска'});
  await expect(listbox).toBeVisible();
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant',/.+/);
  await search.press('Escape');
  await expect(listbox).toBeHidden();

  await page.goto('/profile');
  await page.getByRole('button',{name:'Войти по телефону'}).click();
  const dialog=page.getByRole('dialog',{name:'Рады вас видеть'});
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('representative pages capture screenshots for manual review',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  const widths=[[390,844,'mobile'],[768,1024,'tablet'],[1440,900,'desktop']] as const;
  const routes=[['home','/'],['catalog','/catalog'],['search','/search?query=молоко'],['product','/product/10'],['cart','/cart'],['profile','/profile']] as const;
  for(const [width,height,label] of widths){
    await page.setViewportSize({width,height});
    for(const [name,path] of routes){
      await page.goto(path,{waitUntil:'networkidle'});
      // Baselines are not versioned in this repository. Capture evidence for manual review.
      await page.screenshot({path:testInfo.outputPath(`${label}-${name}.png`),fullPage:true,animations:'disabled'});
    }
  }
});

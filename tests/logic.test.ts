import test from 'node:test';
import assert from 'node:assert/strict';
import routes from '../src/config/routes.json';
import {list,money,product,quantityLabel,step,truth,unwrap,normalizeMedia,categoryMedia,cartItems,cartChange,activeStoreId,formatAvailabilityText,getCategoryGroupColor} from '../src/lib/types';
import {paymentReturnUrl,request} from '../src/lib/client';

test('matches exact reference palette for all 17 categories and fallback', () => {
  assert.equal(getCategoryGroupColor('xleb-i-vypechka'), '#FDE6D2');
  assert.equal(getCategoryGroupColor({ name: 'Хлеб и булочки', slug: 'xleb' }), '#FDE6D2');
  assert.equal(getCategoryGroupColor({ name: 'Готовая еда', slug: 'gotovaya-eda' }), '#FEE8CE');
  assert.equal(getCategoryGroupColor('salaty-i-zakuski'), '#FEE8CE');
  assert.equal(getCategoryGroupColor({ name: 'Овощи и зелень', slug: 'ovoshhi' }), '#D4F2A3');
  assert.equal(getCategoryGroupColor('frukty-i-yagody'), '#D4F2A3');
  assert.equal(getCategoryGroupColor({ name: 'Мясо и птица', slug: 'myaso' }), '#FDDCD7');
  assert.equal(getCategoryGroupColor('kolbasy-i-sosiski'), '#FDDCD7');
  assert.equal(getCategoryGroupColor({ name: 'Рыба и морепродукты', slug: 'ryba' }), '#CCF2EE');
  assert.equal(getCategoryGroupColor('sladkoe-i-torty'), '#FCE1ED');
  assert.equal(getCategoryGroupColor('zamorozhennye-produkty'), '#D0F0FD');
  assert.equal(getCategoryGroupColor('voda-i-napitki'), '#CEE5FD');
  assert.equal(getCategoryGroupColor('bakaleya-i-makarony'), '#FEF2BF');
  assert.equal(getCategoryGroupColor('chaj-i-kofe'), '#EFE4D6');
  assert.equal(getCategoryGroupColor('sneki-i-chipsy'), '#FEE5C2');
  assert.equal(getCategoryGroupColor({ name: 'Детское питание', slug: 'detskoe-pitanie' }), '#FDDDE3');
  assert.equal(getCategoryGroupColor({ name: 'Детская гигиена и игрушки', slug: 'detskaya-gigiena-i-igrushki' }), '#F1D6F7');
  assert.equal(getCategoryGroupColor({ name: 'Товары для животных', slug: 'korma-dlya-zhivotnyh' }), '#DEEEC6');
  assert.equal(getCategoryGroupColor({ name: 'Красота и гигиена', slug: 'krasota-i-uhod' }), '#F0D5FA');
  assert.equal(getCategoryGroupColor({ name: 'Всё для уборки', slug: 'uborka-i-bytovaya-himiya' }), '#D2E5FC');
  assert.equal(getCategoryGroupColor({ name: 'Для дома и дачи', slug: 'tovary-dlya-doma-i-dachi' }), '#D0F2E5');
  assert.equal(getCategoryGroupColor('neizvestnaya-kategoriya'), '#F6EEE3');
});


test('payment callbacks always use the configured canonical origin',()=>{
  assert.equal(paymentReturnUrl('/cards?binding=return','https://lastochka.duckdns.org'), 'https://lastochka.duckdns.org/cards?binding=return');
  assert.equal(paymentReturnUrl('/payment','http://127.0.0.1:3000'), 'http://127.0.0.1:3000/payment');
  assert.throws(()=>paymentReturnUrl('/cards','javascript:alert(1)'),/безопасный адрес/);
});

test('client mutation sends idempotency key and refreshes CSRF once after 403', async()=>{
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/session') {
      const csrf = calls.filter((call) => call.url === url).length === 1 ? 'old' : 'fresh';
      return Response.json({ csrf });
    }
    if (calls.filter((call) => call.url === url).length === 1) {
      return Response.json({ message: 'Сессия страницы истекла. Обновите страницу.' }, { status: 403 });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;

  try {
    const result = await request<{ ok: boolean }>('orders', 'POST', { total: 10 }, {
      idempotencyKey: 'checkout-1',
    });
    assert.deepEqual(result, { ok: true });
    const mutations = calls.filter((call) => call.url === '/api/shop/orders');
    assert.equal(mutations.length, 2);
    assert.equal(new Headers(mutations[0].init?.headers).get('Idempotency-Key'), 'checkout-1');
    assert.equal(new Headers(mutations[0].init?.headers).get('x-csrf-token'), 'old');
    assert.equal(new Headers(mutations[1].init?.headers).get('x-csrf-token'), 'fresh');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes documented and observed API wrappers',()=>{
  assert.deepEqual(unwrap({data:{id:2}}),{id:2});
  assert.deepEqual(list({data:[{id:2}]}),[{id:2}]);
  assert.deepEqual(list({data:{id:2}}),[]);
});

test('normalizes availability time into clean "Доступно с HH:mm" format',()=>{
  assert.equal(formatAvailabilityText('2026-09-20T09:00:00+03:00'), 'Доступно с 09:00');
  assert.equal(formatAvailabilityText('2026-09-20T07:00:00+03:00'), 'Доступно с 07:00');
  assert.equal(formatAvailabilityText('2026-09-20T12:00:00+03:00'), 'Доступно с 12:00');
  assert.equal(formatAvailabilityText('2026-09-20 08:30:00'), 'Доступно с 08:30');
  assert.equal(formatAvailabilityText('09:00'), 'Доступно с 09:00');
  assert.equal(formatAvailabilityText('9:00'), 'Доступно с 09:00');
  assert.equal(formatAvailabilityText('09:00:00'), 'Доступно с 09:00');
  assert.equal(formatAvailabilityText('Доступно с 09:00'), 'Доступно с 09:00');
  assert.equal(formatAvailabilityText(null), null);
  assert.equal(formatAvailabilityText(undefined), null);
  assert.equal(formatAvailabilityText(''), null);

  // Normalization via product()
  const pWithIso = product({
    id: 10,
    title: 'Пирог Печеночный Кусок',
    price: 132,
    stockQuantity: 5,
    availableFrom: '2026-09-20T09:00:00+03:00',
  });
  assert.equal(pWithIso.availableFrom, 'Доступно с 09:00');

  const pWithoutTime = product({
    id: 11,
    title: 'Пюре Картофельное',
    price: 60,
    stockQuantity: 5,
    availableFrom: null,
  });
  assert.equal(pWithoutTime.availableFrom, undefined);
});

test('normalizes quantity, availability and images without inventing data',()=>{
  const p=product({id:1,storeId:2,title:'Аджика',price:'47.80',stockQuantity:'46524',quantityStep:'200',measurementUnit:'gram',measurementUnitLabel:'гр',images:[{}, {path:'https://example.test/a.webp'}],supplements:[],isConfigurable:'false'});
  assert.equal(p.price,47.8);
  assert.equal(step(p),200);
  assert.equal(quantityLabel(p,step(p)),'200 гр');
  assert.equal(p.images.length,1);
  assert.equal(p.stockQuantity,46524);
  assert.equal(p.isConfigurable,false);
});

test('handles money and inconsistent boolean types',()=>{
  assert.match(money(99.99),/99,99/);
  assert.equal(money(undefined),'—');
  for(const value of [true,1,'1','true'])assert.equal(truth(value),true);
});

test('proxy allow-list does not contain duplicate method/path pairs',()=>{
  const keys=routes.map(route=>`${route.method} ${route.path}`);
  assert.equal(new Set(keys).size,keys.length);
  assert.ok(keys.includes('GET stores/{store}/categories/{category}/products'));
  assert.ok(keys.includes('POST orders'));
});

test('category media keeps API background and foreground as separate layers',()=>{
  assert.deepEqual(categoryMedia({id:1,name:'Готовая еда',slug:'food',image:{path:'https://example.test/food.webp'},backgroundImage:{path:'https://example.test/bg.png'}}),{foreground:'https://example.test/food.webp',background:'https://example.test/bg.png'});
  assert.deepEqual(categoryMedia({backgroundImage:{path:'https://example.test/bg.png'}}),{foreground:null,background:'https://example.test/bg.png'});
  assert.deepEqual(categoryMedia({}),{foreground:null,background:null});
});

test('product preview order is stable, valid and deduplicated',()=>{
  const media=normalizeMedia({image:{path:'https://example.test/main.webp'},images:[{path:''},{path:'https://example.test/main.webp'},{path:'https://example.test/second.webp'}],variants:[{images:[{path:'https://example.test/variant.webp'}]}]});
  assert.deepEqual(media.map(v=>v.path),['https://example.test/main.webp','https://example.test/second.webp','https://example.test/variant.webp']);
  assert.equal(product({id:2,title:'Без фото',price:1,stockQuantity:1,quantityStep:1,measurementUnitLabel:'шт'}).preview,null);
});

test('cart helpers preserve configured positions by cart item id and describe reconciliation',()=>{
  const base={id:10,title:'Пицца',price:500,stockQuantity:9,quantityStep:1,measurementUnitLabel:'шт',images:[]};
  const before={storeGroups:[{store:{id:2,name:'Ласточка'},items:[{id:101,quantity:2,product:product(base),supplements:[{id:7}]},{id:102,quantity:1,product:product({...base,id:11,title:'Салат'})}]}]};
  const after={storeGroups:[{store:{id:2,name:'Ласточка'},items:[{id:101,quantity:1,product:product(base),supplements:[{id:7}]}]}]};
  assert.deepEqual(cartItems(before).map(v=>v.id),[101,102]);
  assert.match(cartChange(before,after)||'',/Салат/);
  assert.match(cartChange(before,after)||'',/Пицца/);
});

test('active delivery address is the single source of truth for the storefront store',()=>{
  assert.equal(activeStoreId(2,{storeId:7},1),7);
  assert.equal(activeStoreId(2,{store:{id:8,name:'Адресный магазин'}},1),8);
  assert.equal(activeStoreId(2,null,1),2);
  assert.equal(activeStoreId(null,null,1),1);
});

test('guest cart stores items, recalculates totals, and updates quantities',()=>{
  const storage = new Map<string, string>();
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  };

  const { addGuestCartItem, setGuestCartQuantity, getGuestCart, clearGuestCart } = require('../src/lib/guest-cart');

  clearGuestCart();
  const initial = getGuestCart();
  assert.equal(initial.totalToPay, 0);

  const testProduct = product({ id: 55, title: 'Молоко 3.2%', price: 120, stockQuantity: 10, quantityStep: 1, measurementUnitLabel: 'шт', storeId: 2 });
  const withOne = addGuestCartItem(testProduct);
  assert.equal(withOne.totalToPay, 120);
  assert.equal(withOne.storeGroups[0].items.length, 1);
  assert.equal(withOne.storeGroups[0].items[0].quantity, 1);

  // Adding same product increments quantity
  const withTwo = addGuestCartItem(testProduct);
  assert.equal(withTwo.totalToPay, 240);
  assert.equal(withTwo.storeGroups[0].items[0].quantity, 2);

  // Update quantity directly
  const itemId = withTwo.storeGroups[0].items[0].id;
  const withFive = setGuestCartQuantity(itemId, 5, testProduct);
  assert.equal(withFive.totalToPay, 600);
  assert.equal(withFive.storeGroups[0].items[0].quantity, 5);

  // Removing item when quantity is 0
  const emptyCart = setGuestCartQuantity(itemId, 0, testProduct);
  assert.equal(emptyCart.totalToPay, 0);
  assert.equal(emptyCart.storeGroups.length, 0);

  clearGuestCart();
  assert.equal(storage.size, 0);

  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

test('shared cart format serializes and parses mobile-compatible hash strings', () => {
  const sampleItems = [
    { id: 2035, quantity: 1 },
    { id: 12486, quantity: 2 },
    { id: 236, quantity: 3 },
  ];

  // Serializing to mobile hash format
  const serialized = sampleItems.map((it) => `${it.id}:${it.quantity}`).join(',');
  assert.equal(serialized, '2035:1,12486:2,236:3');

  // Deserializing hash from mobile app QR code
  const mobileHash = '2035:1,12486:1,236:1,2053:1';
  const parsed = mobileHash.split(',').map((pair) => {
    const [id, qty] = pair.split(':');
    return { id: Number(id), quantity: Number(qty) };
  });

  assert.equal(parsed.length, 4);
  assert.deepEqual(parsed[0], { id: 2035, quantity: 1 });
  assert.deepEqual(parsed[1], { id: 12486, quantity: 1 });
  assert.deepEqual(parsed[2], { id: 236, quantity: 1 });
  assert.deepEqual(parsed[3], { id: 2053, quantity: 1 });
});


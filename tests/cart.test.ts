import test from 'node:test';
import assert from 'node:assert/strict';
import { product, itemAmount, cartGroupTotals, cartTotal } from '../src/lib/types';
import { addGuestCartItem, getGuestCart, setGuestCartQuantity, mergeGuestCartToServer, saveGuestCart, syncGuestCartStores } from '../src/lib/guest-cart';
import { encodeSharedCart, parseSharedCart } from '../src/lib/shared-cart';

const memory = new Map<string,string>();
Object.assign(globalThis, { window: {}, localStorage: {
  getItem: (key:string) => memory.get(key) ?? null,
  setItem: (key:string, value:string) => memory.set(key,value),
  removeItem: (key:string) => memory.delete(key),
} });
const portion = product({ id: 20, storeId: 3, title: 'Салат', price: 47.8, quantityStep: 200,
  supplements: [{id: 1, title:'Соус', values:[{id: 8,price:10}]}] });

test('guest adds one 200g portion, edits quantity, retains store and charges per portion with extras', () => {
  memory.clear();
  let cart = addGuestCartItem(portion, [{supplementId:1,valueIds:[8]}]);
  assert.equal(cart.total, 57.8);
  assert.equal(cart.storeGroups![0].store.id, 3);
  const item = cart.storeGroups![0].items[0];
  cart = setGuestCartQuantity(item.id, 400);
  assert.equal(cart.total, 115.6);
  assert.equal(cart.storeGroups![0].items[0].quantity, 400);
  assert.equal(itemAmount({...item, price:0, supplementsTotal:3}),3);
  assert.throws(() => setGuestCartQuantity(item.id,201),/количество/);
});

test('shared cart roundtrip preserves variant ID, store, exact quantity and supplement configuration', () => {
  memory.clear();
  const cart = addGuestCartItem(portion,[{supplementId:1,valueIds:[8],valueQuantities:[{valueId:8,quantity:2}]}]);
  const shared = parseSharedCart(encodeSharedCart(cart.storeGroups![0].items));
  assert.deepEqual(shared[0], {id:20,quantity:200,storeId:3,supplements:[{supplementId:1,valueIds:[8],valueQuantities:[{valueId:8,quantity:2}]}]});
  memory.clear();
  const imported = addGuestCartItem(portion,shared[0].supplements,shared[0].quantity);
  assert.equal(imported.storeGroups![0].items[0].quantity,200);
  assert.throws(() => parseSharedCart('20:200'), /Старая ссылка/);
  for (const bad of [{...shared[0],quantity:1e10},{...shared[0],storeId:null},{...shared[0],quantity:-1}]) {
    assert.throws(() => parseSharedCart('v2.'+encodeURIComponent(JSON.stringify({version:2,items:[bad]}))));
  }
  assert.throws(() => parseSharedCart('v2.'+encodeURIComponent(JSON.stringify({version:2,items:Array(51).fill(shared[0])}))));
});

test('partial transfer keeps rejects; lost response retries same server idempotency key without duplicates', async () => {
  memory.clear();
  addGuestCartItem(portion);
  addGuestCartItem({...portion,id:21});
  const serverKeys = new Set<string>();
  let failOnce = true;
  let reject = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if(String(url)==='/shop/api/session') return Response.json({csrf:'test'});
    const body = JSON.parse(options?.body as string);
    if(body.productId===21 && reject) return Response.json({message:'Нет в наличии'},{status:422});
    const key = (options?.headers as Record<string,string>)['Idempotency-Key'];
    assert.ok(key);
    serverKeys.add(key);
    if (failOnce) { failOnce=false; throw new Error('Response lost after server accepted'); }
    return Response.json({data:{storeGroups:[]}});
  };
  try {
    assert.deepEqual(await mergeGuestCartToServer(),{accepted:0,remaining:2});
    const pending = getGuestCart().storeGroups![0].items[0];
    assert.throws(() => setGuestCartQuantity(pending.id,400), /повторите перенос/);
    assert.deepEqual(await mergeGuestCartToServer(),{accepted:1,remaining:1});
    assert.equal(serverKeys.size,1);
    reject=false;
    assert.deepEqual(await mergeGuestCartToServer(),{accepted:1,remaining:0});
    assert.equal(serverKeys.size,2);
    assert.equal(getGuestCart().storeGroups!.length,0);
  } finally { globalThis.fetch=originalFetch; }
});


test('guest cart hydrates actual store address and capabilities and never invents pickup', () => {
  memory.clear();
  const cart = addGuestCartItem(portion);
  assert.equal(cart.storeGroups![0].store.isPickupEnabled, undefined);
  const store = { id: 3, name: 'Ласточка на Ленина', address: 'ул. Ленина, 20', isPickupEnabled: false, pickupPaymentMethods: ['cash'], minOrderAmount: 500 };
  const hydrated = syncGuestCartStores([store]);
  assert.deepEqual(hydrated.storeGroups![0].store, store);
  assert.deepEqual(getGuestCart().storeGroups![0].store, store);
  const updated = addGuestCartItem(portion, [], 200, { ...store, isPickupEnabled: true });
  assert.equal(updated.storeGroups![0].store.isPickupEnabled, true);
  assert.equal(updated.storeGroups![0].items[0].quantity, 400);
  const missing = syncGuestCartStores([]);
  assert.equal(missing.storeGroups![0].store.isPickupEnabled, undefined);
});

test('header and cart totals share cent rounding, supplements, zero price, delivery and discounts', () => {
  const group = { store: { id: 3, name: 'Ласточка' }, items: [
    { id: 1, product: portion, quantity: 400, supplements: [{ supplementId: 1, valueIds: [8] }] },
    { id: 2, product: portion, quantity: 200, price: 0 },
  ], assemblyCost: 10.1, deliveryCost: 80.2, discount: 5.3 };
  assert.deepEqual(cartGroupTotals(group), { items: 115.6, assembly: 10.1, delivery: 80.2, discount: 5.3, total: 200.6 });
  assert.equal(cartTotal({ storeGroups: [group] }), cartGroupTotals(group).total);
  assert.equal(cartTotal({ storeGroups: [group] }, true), 120.4);
  assert.equal(cartGroupTotals(group, true, 20).total, 100.4);
});

test('simultaneous guest merge calls share one transfer and send each item once', async () => {
  memory.clear();
  addGuestCartItem(portion);
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === '/shop/api/session') return Response.json({ csrf: 'test' });
    writes++;
    assert.equal(JSON.parse(options?.body as string).storeId, 3);
    return Response.json({ data: { storeGroups: [] } });
  };
  try {
    const [first, second] = await Promise.all([mergeGuestCartToServer(), mergeGuestCartToServer()]);
    assert.deepEqual(first, { accepted: 1, remaining: 0 });
    assert.deepEqual(second, first);
    assert.equal(writes, 1);
    assert.equal(getGuestCart().totalToPay, 0);
  } finally { globalThis.fetch = originalFetch; }
});

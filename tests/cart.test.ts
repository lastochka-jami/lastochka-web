import test from 'node:test';
import assert from 'node:assert/strict';
import { product, itemAmount } from '../src/lib/types';
import { addGuestCartItem, getGuestCart, setGuestCartQuantity, mergeGuestCartToServer, saveGuestCart } from '../src/lib/guest-cart';
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
    if(String(url)==='/api/session') return Response.json({csrf:'test'});
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

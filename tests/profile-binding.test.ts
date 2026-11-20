import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileStore } from '../src/lib/profile-state';
import { bindingError, checkBinding, readPendingBinding } from '../src/lib/card-binding';
import { storefrontOrigin, validatePaymentReturn } from '../src/lib/payment-return';
import { canCancelOrder } from '../src/lib/order-actions';

test('orders without optional canCancel use API statuses and respect explicit restrictions', () => {
  for (const status of ['draft', 'pending', 'assembling']) {
    assert.equal(canCancelOrder({ status }), true);
    assert.equal(canCancelOrder({ status, canCancel: false }), false);
  }
  for (const status of ['assembled', 'inDelivery', 'delivered', 'cancelled', 'unknown']) {
    assert.equal(canCancelOrder({ status }), false);
    assert.equal(canCancelOrder({ status, canCancel: true }), false);
  }
});

const user = (id: number, bonusBalance: number) => ({ data: { id, bonusBalance } });

test('profile errors keep the last known balance; missing data never becomes zero', async () => {
  let response: unknown = user(1, 125);
  let fail = true;
  const store = new ProfileStore(async () => { if (fail) throw new Error('offline'); return response; });
  store.setSession('a');
  await store.refresh();
  assert.equal(store.getSnapshot().data, undefined);
  assert.match(store.getSnapshot().error, /offline/);
  fail = false;
  await store.refresh();
  assert.equal(store.getSnapshot().data?.bonusBalance, 125);
  fail = true;
  await store.refresh();
  assert.equal(store.getSnapshot().data?.bonusBalance, 125);
  fail = false;
  response = { data: { id: 1 } };
  await store.refresh();
  assert.equal(store.getSnapshot().data?.bonusBalance, 125);
  response = user(1, 0);
  await store.refresh();
  assert.equal(store.getSnapshot().data?.bonusBalance, 0);
});

test('account changes and logout discard profile and invalidate late responses', async () => {
  const pending: ((value: unknown) => void)[] = [];
  const store = new ProfileStore(() => new Promise(resolve => pending.push(resolve)));
  store.setSession('a');
  const old = store.refresh();
  store.setSession('b');
  assert.equal(store.getSnapshot().data, undefined);
  const fresh = store.refresh();
  pending[1](user(2, 20));
  await fresh;
  pending[0](user(1, 100));
  await old;
  assert.equal(store.getSnapshot().data?.id, 2);
  assert.equal(store.getSnapshot().data?.bonusBalance, 20);
  const late = store.refresh();
  store.setSession(null);
  pending[2](user(2, 500));
  await late;
  assert.equal(store.getSnapshot().data, undefined);
});

test('422 returnUrl validation and payment refusal have different messages', () => {
  assert.equal(bindingError(Object.assign(new Error('Банк отклонил привязку'), {status: 422, data: {message: 'Банк отклонил привязку'}})), 'Банк отклонил привязку');
  assert.match(bindingError({status: 422, data: {errors: {returnUrl: ['Invalid']}}}), /адрес возврата/);
  assert.equal(readPendingBinding(JSON.stringify({userId: 1, cardIds: [], startedAt: Date.now()}), 2), null);
  assert.equal(readPendingBinding(JSON.stringify({userId: 1, cardIds: [], startedAt: Date.now() - 31*60_000}), 1), null);
});

const signal = () => new AbortController().signal;
const wait = async () => {};
test('return is confirmed only by a new server card, including delayed synchronization', async () => {
  let calls = 0;
  const result = await checkBinding({baseline: [1], signal: signal(), wait, load: async () => ({data: ++calls < 3 ? [{id:1}] : [{id:1},{id:2}]})});
  assert.equal(result, 'confirmed');
  assert.equal(calls, 3);
  assert.equal(await checkBinding({baseline: [1], signal: signal(), wait, load: async () => ({data:[{id:1},{id:2}]})}), 'confirmed');
});

test('existing cards and untrusted return flags never confirm success; polling is bounded', async () => {
  for (const baseline of [[1], null]) {
    let calls = 0;
    assert.equal(await checkBinding({baseline, signal: signal(), wait, load: async () => {calls++; return {data:[{id:1}]};}}), 'unconfirmed');
    assert.equal(calls, 5);
  }
  assert.equal(await checkBinding({baseline: [], signal: signal(), wait, load: async () => {throw new Error('offline');}}), 'unavailable');
  const controller = new AbortController();
  const aborted = checkBinding({baseline: [], signal:controller.signal, wait, load: async () => {controller.abort(); return {data:[{id:2}]};}});
  assert.equal(await aborted, 'aborted');
});

test('both storefront domains retain their own return origin despite a legacy override', () => {
  const previous = {...process.env};
  process.env.PUBLIC_ORIGIN = 'https://lastochki.store';
  process.env.SECONDARY_PUBLIC_ORIGIN = 'https://lastochka.duckdns.org';
  process.env.ALLOWED_PAYMENT_RETURN_URL = 'https://lastochki.store';
  try {
    for (const origin of [process.env.PUBLIC_ORIGIN, process.env.SECONDARY_PUBLIC_ORIGIN]) {
      const req = new Request(origin+'/shop/api/shop/payment-cards/bind', {headers: {origin, host: new URL(origin).host}});
      const target = origin+'/shop/cards?binding=return';
      assert.equal(storefrontOrigin(req), origin);
      assert.equal(validatePaymentReturn(target, req), target);
      assert.equal(validatePaymentReturn('https://evil.test/shop/cards', req), null);
      assert.equal(validatePaymentReturn('https://lastochki.store@evil.test/shop/cards', req), null);
      assert.equal(validatePaymentReturn(origin+'/other', req), null);
      const other: string = origin === process.env.PUBLIC_ORIGIN ? process.env.SECONDARY_PUBLIC_ORIGIN : process.env.PUBLIC_ORIGIN;
      assert.equal(validatePaymentReturn(other+'/shop/cards', req), null);
    }
  } finally {
    for (const key of ['PUBLIC_ORIGIN', 'SECONDARY_PUBLIC_ORIGIN', 'ALLOWED_PAYMENT_RETURN_URL']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

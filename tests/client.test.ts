import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../src/lib/client';

test('network and API errors retain actionable status and never become successful empty data', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [401,403,422,429,500]) {
      globalThis.fetch = async () => Response.json({message:`Failure ${status}`},{status});
      await assert.rejects(request('cart'), (e:any) => e.status===status && e.message===`Failure ${status}`);
    }
    globalThis.fetch = async () => { throw new Error('Network disconnected'); };
    await assert.rejects(request('cart'),/Network disconnected/);
  } finally { globalThis.fetch=original; }
});

test('concurrent GETs share work, settle without caching, and failed reads can retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let release!: () => void;
  try {
    globalThis.fetch = async () => {
      calls++;
      await new Promise<void>(resolve => { release = resolve; });
      return Response.json({ value: calls });
    };
    const first = request('dedup-test');
    const second = request('/api/shop/dedup-test');
    assert.equal(calls, 1);
    release();
    assert.deepEqual(await Promise.all([first, second]), [{ value: 1 }, { value: 1 }]);
    const third = request('dedup-test');
    assert.equal(calls, 2);
    release();
    await third;
    globalThis.fetch = async () => { calls++; throw new Error('offline'); };
    await assert.rejects(request('dedup-test'), /offline/);
    await assert.rejects(request('dedup-test'), /offline/);
    assert.equal(calls, 4);
  } finally { globalThis.fetch = original; }
});

test('session reads coalesce only while pending and refresh after settlement', async () => {
  const { browserSession } = await import('../src/lib/client');
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return Response.json({ authenticated: false, csrf: 'test' }); };
    await Promise.all([browserSession(), browserSession()]);
    assert.equal(calls, 1);
    await browserSession();
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('mutations invalidate pending read sharing and are never deduplicated', async () => {
  const original = globalThis.fetch;
  let reads = 0;
  let writes = 0;
  const releases: (() => void)[] = [];
  try {
    globalThis.fetch = async (_url, options) => {
      if (options?.method === 'POST') { writes++; return Response.json({}); }
      reads++;
      await new Promise<void>(resolve => releases.push(resolve));
      return Response.json({});
    };
    const old = request('dedup-cart');
    await Promise.all([request('dedup-cart', 'POST'), request('dedup-cart', 'POST')]);
    const fresh = request('dedup-cart');
    assert.equal(reads, 2);
    assert.equal(writes, 2);
    releases.forEach(resolve => resolve());
    await Promise.all([old, fresh]);
  } finally { globalThis.fetch = original; }
});

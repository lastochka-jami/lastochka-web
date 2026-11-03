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

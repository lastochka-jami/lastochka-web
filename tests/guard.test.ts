import test from 'node:test';
import assert from 'node:assert/strict';
import { validMutation } from '../src/lib/guard';

test('both configured storefront origins work, while foreign origins and CSRF fail', () => {
  const previous = { PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN, SECONDARY_PUBLIC_ORIGIN: process.env.SECONDARY_PUBLIC_ORIGIN };
  process.env.PUBLIC_ORIGIN = 'https://lastochki.store';
  process.env.SECONDARY_PUBLIC_ORIGIN = 'https://lastochka.duckdns.org';
  const session = { id: 'test', csrf: 'csrf', token: null, expires: Date.now() + 1000, store: 2 };
  const req = (origin: string, csrf = 'csrf', site = 'same-origin') => new Request('https://lastochki.store/shop/api/store', {
    method: 'POST', headers: { origin, 'x-csrf-token': csrf, 'sec-fetch-site': site },
  });
  try {
    assert.equal(validMutation(req('https://lastochki.store'), session), true);
    assert.equal(validMutation(req('https://lastochka.duckdns.org'), session), true);
    assert.equal(validMutation(req('https://foreign.test'), session), false);
    assert.equal(validMutation(req('https://lastochka.duckdns.org', 'bad'), session), false);
    assert.equal(validMutation(req('https://lastochki.store', 'csrf', 'cross-site'), session), false);
    assert.equal(validMutation(req('https://lastochki.store'), null), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, normalizeOtp } from '../src/lib/phone-auth';
import { requestPhoneCode, confirmPhoneCode } from '../src/lib/client';

test('phone accepts full Russian formats and rejects incomplete, foreign and overlong numbers', () => {
  for (const input of ['+7 (999) 123-45-67', '8 999 123 45 67', '79991234567', '9991234567', '  +7 999.123.45.67  ']) {
    assert.equal(normalizePhone(input), '+79991234567');
  }
  for (const input of ['', '+7', '999123456', '+799912345678', '+19991234567', '+89991234567', '+7abc9991234567', '7+9991234567', '++79991234567', '0000000000']) {
    assert.throws(() => normalizePhone(input), /номер телефона/);
  }
  assert.equal(normalizeOtp('001234', 6), '001234');
  for (const code of ['123', '1234567', '12a456', '']) assert.throws(() => normalizeOtp(code, 6), /6 цифр/);
});

test('OTP flow uses normalized phone, validates before requests and preserves API errors without sending SMS', async () => {
  const originalFetch = globalThis.fetch;
  const calls: { path: string; body: any }[] = [];
  let reject = false;
  globalThis.fetch = async (url, options) => {
    const path = String(url);
    // This mock intercepts every fetch; no network or SMS provider is contacted.
    if (path === '/shop/api/session') return Response.json({ csrf: 'mock-csrf' });
    calls.push({ path, body: JSON.parse(options?.body as string) });
    if (reject) return Response.json({ message: 'Неверный код' }, { status: 422 });
    return Response.json(path.endsWith('phone-login') ? { data: { codeLength: 4 } } : { user: { id: 1 } });
  };
  try {
    await assert.rejects(requestPhoneCode('+7'), /номер телефона/);
    assert.equal(calls.length, 0);
    const sent = await requestPhoneCode('8 (999) 123-45-67');
    assert.deepEqual(sent, { phone: '+79991234567', codeLength: 4 });
    assert.deepEqual(calls[0], { path: '/shop/api/shop/auth/phone-login', body: { phone: '+79991234567', method: 'sms' } });
    await assert.rejects(confirmPhoneCode(sent.phone, '123', sent.codeLength), /4 цифр/);
    assert.equal(calls.length, 1);
    await confirmPhoneCode(sent.phone, '0012', sent.codeLength);
    assert.deepEqual(calls[1], { path: '/shop/api/shop/auth/phone-confirm', body: { phone: '+79991234567', code: '0012' } });
    reject = true;
    await assert.rejects(confirmPhoneCode(sent.phone, '0000', sent.codeLength), (error: any) => error.status === 422 && error.message === 'Неверный код');
  } finally { globalThis.fetch = originalFetch; }
});

'use client';

import { normalizePhone, normalizeOtp } from './phone-auth';
import { appPath } from './app-path';
import { unwrap } from './types';

let cachedCsrfToken = '';
let pendingSession: Promise<BrowserSessionData> | undefined;
const pendingGets = new Map<string, Promise<any>>();

export interface BrowserSessionData {
  authenticated: boolean;
  csrf: string;
  storeId: number;
  checkoutEnabled: boolean;
  publicOrigin: string;
}

export function paymentReturnUrl(path: string, publicOrigin: string): string {
  const origin = new URL(publicOrigin);
  if (!/^https?:$/.test(origin.protocol)) throw new Error('Не настроен безопасный адрес возврата');
  return new URL(appPath(path), `${origin.origin}/`).toString();
}

async function loadBrowserSession(): Promise<BrowserSessionData> {
  const response = await fetch(appPath('/api/session'), { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "Не удалось загрузить сессию");
  cachedCsrfToken = data.csrf;
  return data;
}

export function browserSession(): Promise<BrowserSessionData> {
  if (!pendingSession) {
    pendingSession = loadBrowserSession().finally(() => { pendingSession = undefined; });
  }
  return pendingSession;
}

export async function requestPhoneCode(input: string): Promise<{ phone: string; codeLength: number }> {
  const phone = normalizePhone(input);
  const data = unwrap<{ codeLength?: number }>(await request('auth/phone-login', 'POST', { phone, method: 'sms' }));
  const length = Number(data?.codeLength);
  return { phone, codeLength: Number.isSafeInteger(length) && length >= 4 && length <= 8 ? length : 6 };
}

export async function confirmPhoneCode(phone: string, code: string, length: number): Promise<void> {
  await request('auth/phone-confirm', 'POST', { phone: normalizePhone(phone), code: normalizeOtp(code, length) });
}

async function sendRequest<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  if (method !== 'GET' && !cachedCsrfToken) {
    await browserSession();
  }

  const url = path.startsWith('/api/') ? path : `/api/shop/${path}`;
  const send = () => {
    const headers: Record<string, string> = {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'x-csrf-token': cachedCsrfToken } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    };
    return fetch(appPath(url), {
      method,
      cache: 'no-store',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send();
  // A stale CSRF token is the proxy's only 403 case. Refresh the browser session
  // and retry once; 401 remains an authentication error for the UI to handle.
  const expiredCsrf =
    response.status === 403 &&
    method !== 'GET' &&
    (await response
      .clone()
      .json()
      .then((data) => data?.message === 'Сессия страницы истекла. Обновите страницу.')
      .catch(() => false));
  if (expiredCsrf) {
    cachedCsrfToken = '';
    await browserSession();
    response = await send();
  }

  const data = await response.json().catch(() => undefined);
  if (data?.csrf) cachedCsrfToken = data.csrf;

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new Event('lastochka:unauthorized'));
    const fields = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
    const message =
      [data?.message, fields].filter(Boolean).join(' ') || 'Не удалось выполнить запрос';
    throw Object.assign(new Error(message), { status: response.status, data });
  }

  return data as T;
}

// Share only in-flight browser reads, never settled or server-wide personal data.
export function request<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  if (method !== 'GET') {
    pendingGets.clear();
    return sendRequest<T>(path, method, body, options).finally(() => pendingGets.clear());
  }
  const key = path.startsWith('/api/') ? path : `/api/shop/${path}`;
  const existing = pendingGets.get(key);
  if (existing) return existing;
  const pending = sendRequest<T>(path, method, body, options).finally(() => {
    if (pendingGets.get(key) === pending) pendingGets.delete(key);
  });
  pendingGets.set(key, pending);
  return pending;
}

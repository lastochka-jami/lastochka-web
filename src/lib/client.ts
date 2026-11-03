'use client';

let cachedCsrfToken = '';

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
  return new URL(path, `${origin.origin}/`).toString();
}

export async function browserSession(): Promise<BrowserSessionData> {
  const response = await fetch('/api/session', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "Не удалось загрузить сессию");
  cachedCsrfToken = data.csrf;
  return data;
}

export async function request<T = any>(
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
    return fetch(url, {
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

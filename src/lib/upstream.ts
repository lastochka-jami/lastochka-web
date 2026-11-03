import 'server-only';
import { session } from './session';
import { activeStoreId, Address } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: any,
  ) {
    super(payload?.message || 'Сервис временно недоступен. Попробуйте ещё раз.');
  }
}

export interface UpstreamOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
  cache?: RequestCache;
  revalidate?: number;
}

export async function upstream(path: string, init: UpstreamOptions = {}) {
  const baseUrl = process.env.API_BASE_URL || 'https://lastochki.store/api/v1';
  const url = `${baseUrl}/${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
  };

  const isPublicGet = (!init.method || init.method === 'GET') && !init.token;
  const revalidate = init.revalidate ?? (isPublicGet ? 60 : undefined);

  const fetchOptions: RequestInit = {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  };

  if (init.cache === 'no-store') {
    fetchOptions.cache = 'no-store';
  } else if (revalidate !== undefined) {
    (fetchOptions as any).next = { revalidate };
  } else if (init.cache) {
    fetchOptions.cache = init.cache;
  } else {
    fetchOptions.cache = 'no-store';
  }

  const response = await fetch(url, fetchOptions);

  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => ({ message: 'Сервис вернул некорректный ответ' }));

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

export async function api(path: string, options: UpstreamOptions = {}) {
  const currentSession = await session();
  return upstream(path, { ...options, token: options.token ?? currentSession?.token });
}

export async function publicApi(path: string, options: UpstreamOptions = {}) {
  return upstream(path, { ...options, revalidate: options.revalidate ?? 60 });
}

export async function selectedStore(): Promise<number> {
  const currentSession = await session();
  const id = activeStoreId(currentSession?.store, null, Number(process.env.DEFAULT_STORE_ID) || 2);
  // Store 8 is a blank technical placeholder with 0 products; fallback to active store 2
  return id === 8 || !id ? 2 : id;
}

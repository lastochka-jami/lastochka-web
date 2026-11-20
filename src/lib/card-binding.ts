import { list, type PaymentCardDto } from './types';

export const BINDING_STORAGE_KEY = 'lastochka-card-binding';
export interface PendingBinding { userId: number; cardIds: number[]; startedAt: number }

export function readPendingBinding(value: string | null, userId?: number): PendingBinding | null {
  try {
    const binding = JSON.parse(value || 'null');
    if (binding?.userId !== userId || !Number.isFinite(binding?.startedAt) ||
      Date.now() - binding.startedAt > 30 * 60_000 || binding.startedAt > Date.now() ||
      !Array.isArray(binding.cardIds) || !binding.cardIds.every((id: unknown) => Number.isSafeInteger(id))) return null;
    return binding;
  } catch { return null; }
}

export function bindingError(error: any): string {
  if (error?.data?.errors && Object.hasOwn(error.data.errors, 'returnUrl')) {
    return 'Не удалось использовать адрес возврата на этот сайт. Обратитесь в поддержку или попробуйте позже.';
  }
  return error instanceof Error ? error.message : 'Не удалось открыть страницу привязки. Попробуйте ещё раз.';
}

/** GET /payment-cards synchronizes the gateway. A URL flag is never evidence of success. */
export async function checkBinding(options: {
  load: () => Promise<unknown>;
  baseline: number[] | null;
  signal: AbortSignal;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<'confirmed' | 'unconfirmed' | 'unavailable' | 'aborted'> {
  let successfulRead = false;
  const wait = options.wait || ((ms, signal) => new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  }));
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await wait(2000, options.signal);
    if (options.signal.aborted) return 'aborted';
    try {
      const response = await options.load();
      if (options.signal.aborted) return 'aborted';
      if (!response) continue; // useRemote exposes a failed read as undefined, with an error in the UI.
      successfulRead = true;
      const cards = list<PaymentCardDto>(response);
      if (options.baseline && cards.some(card => Number.isSafeInteger(card.id) && !options.baseline!.includes(card.id))) return 'confirmed';
    } catch (error: any) {
      if (error?.status === 401) return 'unavailable';
    }
  }
  return successfulRead ? 'unconfirmed' : 'unavailable';
}

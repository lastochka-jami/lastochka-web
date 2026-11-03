import { NextResponse } from 'next/server';
import { session, setStore } from '@/lib/session';
import { validMutation } from '@/lib/guard';
import { upstream, ApiError } from '@/lib/upstream';

export async function POST(req: Request) {
  const currentSession = await session();
  if (!validMutation(req, currentSession)) {
    return NextResponse.json({ message: 'Обновите страницу' }, { status: 403 });
  }

  try {
    const { storeId, addressId } = await req.json();
    if (!Number.isSafeInteger(storeId)) {
      return NextResponse.json({ message: 'Выберите магазин' }, { status: 422 });
    }
    if (addressId !== undefined && (!Number.isSafeInteger(addressId) || addressId < 1)) {
      return NextResponse.json({ message: 'Выберите корректный адрес доставки' }, { status: 422 });
    }
    if (addressId !== undefined && !currentSession!.token) {
      return NextResponse.json({ message: 'Войдите, чтобы выбрать адрес доставки' }, { status: 401 });
    }

    const stores = await upstream(
      addressId === undefined ? 'stores?perPage=100' : `stores?addressId=${addressId}&perPage=100`,
      { token: currentSession!.token },
    );
    const chosen = stores.data?.find(
      (x: { id: number; isActive?: boolean; name?: string }) =>
        x.id === storeId &&
        x.isActive &&
        x.id !== 8 &&
        x.name?.trim().toLowerCase() !== 'default',
    );

    if (!chosen) {
      return NextResponse.json({ message: 'Магазин недоступен' }, { status: 422 });
    }

    let cart = null;
    if (currentSession!.token) {
      await upstream('cart/store', {
        method: 'POST',
        body: { storeId },
        token: currentSession!.token,
      });
      const response = await upstream('cart', { token: currentSession!.token });
      cart = response?.data ?? response;
    }

    await setStore(currentSession!, storeId);

    return NextResponse.json(
      { ok: true, store: chosen, cart },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      err instanceof ApiError
        ? err.payload
        : { message: err instanceof Error ? err.message : 'Ошибка выбора магазина' },
      { status: err instanceof ApiError ? err.status : 502 },
    );
  }
}

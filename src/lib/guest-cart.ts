import { Product, Cart, CartItem, step, itemAmount, CartStoreGroup } from './types';
import { request } from './client';

const GUEST_CART_STORAGE_KEY = 'lastochka_guest_cart_v1';

export function getGuestCart(): Cart {
  if (typeof window === 'undefined') {
    return { storeGroups: [], totalToPay: 0, total: 0 };
  }
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return { storeGroups: [], totalToPay: 0, total: 0 };
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.storeGroups) ? recalculateCartTotals(parsed.storeGroups) : { storeGroups: [], totalToPay: 0, total: 0 };
  } catch {
    return { storeGroups: [], totalToPay: 0, total: 0 };
  }
}

export function saveGuestCart(cart: Cart): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    throw new Error("Не удалось сохранить корзину на устройстве. Проверьте доступ к хранилищу.");
  }
}

export function clearGuestCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function recalculateCartTotals(storeGroups: CartStoreGroup[]): Cart {
  let grandTotal = 0;

  for (const group of storeGroups) {
    let groupTotal = 0;
    for (const item of group.items) {
      const itemTotal = itemAmount(item);
      groupTotal += itemTotal;
    }
    group.total = groupTotal;
    group.totalToPay = groupTotal;
    grandTotal += groupTotal;
  }

  return {
    storeGroups: storeGroups.filter((g) => g.items.length > 0),
    total: grandTotal,
    totalToPay: grandTotal,
  };
}

export function addGuestCartItem(p: Product, supplements?: unknown[], quantity = step(p)): Cart {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99999 || quantity % step(p)) throw new Error("Некорректное количество товара");
  const current = getGuestCart();
  const groups: CartStoreGroup[] = current.storeGroups ? [...current.storeGroups] : [];

  const storeId = p.storeId;
  if (!storeId) throw new Error("Выберите магазин перед добавлением товара");
  let targetGroup = groups.find((g) => g.store.id === storeId);

  if (!targetGroup) {
    targetGroup = {
      store: {
        id: storeId,
        name: 'Магазин доставки',
        isPickupEnabled: true,
      },
      items: [],
    };
    groups.push(targetGroup);
  }

  const existingItemIndex = targetGroup.items.findIndex(
    (item) =>
      item.product.id === p.id &&
      JSON.stringify(item.supplements || []) === JSON.stringify(supplements || []),
  );

  const quantityDelta = quantity;

  if (existingItemIndex >= 0) {
    const existing = targetGroup.items[existingItemIndex];
    if (existing.transferKey) throw new Error("Сначала повторите перенос этой позиции: предыдущий ответ не получен.");
    if (existing.quantity + quantityDelta > 99999) throw new Error("Слишком большое количество");
    existing.quantity += quantityDelta;
    existing.transferKey = undefined;
  } else {
    const newItem: CartItem = {
      id: -Math.floor(Date.now() + Math.random() * 1000), // Negative temporary ID
      quantity: quantityDelta,
      price: p.price,
      product: p,
      supplements: supplements || [],
    };
    targetGroup.items.push(newItem);
  }

  const updatedCart = recalculateCartTotals(groups);
  saveGuestCart(updatedCart);
  return updatedCart;
}

export function setGuestCartQuantity(itemId: number, quantity: number, p?: Product): Cart {
  const current = getGuestCart();
  const groups: CartStoreGroup[] = current.storeGroups ? [...current.storeGroups] : [];

  for (const group of groups) {
    const idx = group.items.findIndex(
      (item) => item.id === itemId || (p && item.product.id === p.id && !item.supplements?.length),
    );
    if (idx >= 0) {
      if (group.items[idx].transferKey) throw new Error("Сначала повторите перенос этой позиции: предыдущий ответ не получен.");
      if (quantity <= 0) {
        group.items.splice(idx, 1);
      } else {
        if (!Number.isSafeInteger(quantity) || quantity > 99999 || quantity % step(group.items[idx].product)) throw new Error("Некорректное количество товара");
        group.items[idx].quantity = quantity;
        group.items[idx].transferKey = undefined;
      }
      break;
    }
  }

  const updatedCart = recalculateCartTotals(groups);
  saveGuestCart(updatedCart);
  return updatedCart;
}

let merging: Promise<{ accepted: number; remaining: number }> | undefined;

export function mergeGuestCartToServer(): Promise<{ accepted: number; remaining: number }> {
  if (merging) return merging;
  const transfer = typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('lastochka-guest-cart-transfer', transferGuestCart)
    : transferGuestCart();
  merging = transfer.finally(() => { merging = undefined; });
  return merging;
}

async function transferGuestCart() {
  const cart = getGuestCart();
  let accepted = 0;
  for (const group of cart.storeGroups || []) {
    for (const item of [...group.items]) {
      // Persist before sending: a lost response must retry with the same key.
      // Server replay records live for 24h. Beyond 23h require reconciliation,
      // rather than blindly repeating a possibly accepted write after expiry.
      if (item.transferKey && item.transferStartedAt && Date.now() - item.transferStartedAt > 23 * 60 * 60 * 1000) continue;
      item.transferKey ||= crypto.randomUUID();
      item.transferStartedAt ||= Date.now();
      saveGuestCart(cart);
      try {
        await request('cart/items', 'POST', {
          productId: item.product.id,
          quantity: item.quantity,
          storeId: group.store.id,
          supplements: item.supplements,
        }, { idempotencyKey: item.transferKey });
        group.items = group.items.filter(i => i.id !== item.id);
        accepted++;
        saveGuestCart(recalculateCartTotals(cart.storeGroups || []));
      } catch (error: any) {
        if (error?.status >= 400 && error.status < 500 && error.status !== 409 && error.status !== 408) {
          item.transferKey = undefined;
          item.transferStartedAt = undefined;
          saveGuestCart(cart);
        }
        // Keep rejected and ambiguous writes, including their retry keys.
      }
    }
  }
  const remaining = (cart.storeGroups || []).reduce((n, g) => n + g.items.length, 0);
  return { accepted, remaining };
}

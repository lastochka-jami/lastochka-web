import { CartItem, step } from './types';

export interface SharedItem {
  id: number;
  quantity: number;
  storeId: number;
  supplements: { supplementId: number; valueIds: number[]; valueQuantities?: { valueId: number; quantity: number }[] }[];
}
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
export function parseSharedCart(raw: string): SharedItem[] {
  if (raw.length > 16000) throw new Error('Слишком большая ссылка на корзину');
  let items: any[];
  if (raw.startsWith('v2.')) {
    const value = JSON.parse(decodeURIComponent(raw.slice(3)));
    if (value.version !== 2 || !Array.isArray(value.items)) throw new Error('Неверный формат корзины');
    items = value.items;
  } else {
    // Old links have no store or configuration; require a new complete link.
    throw new Error('Старая ссылка не содержит магазин и добавки. Попросите новую ссылку.');
  }
  if (!items.length || items.length > 50) throw new Error('В ссылке должно быть от 1 до 50 позиций');
  return items.map(i => {
    if (!positive(i.id) || !positive(i.storeId) || !positive(i.quantity) || i.quantity > 99999 || !Array.isArray(i.supplements) || i.supplements.length > 20) throw new Error('Некорректная позиция корзины');
    const supplements = i.supplements.map((s: any) => {
      if (!positive(s.supplementId) || !Array.isArray(s.valueIds) || !s.valueIds.length || s.valueIds.length > 30 || !s.valueIds.every(positive) || new Set(s.valueIds).size !== s.valueIds.length) throw new Error('Некорректные добавки');
      if (s.valueQuantities && (!Array.isArray(s.valueQuantities) || s.valueQuantities.length > 30 || !s.valueQuantities.every((v: any) => s.valueIds.includes(v.valueId) && positive(v.quantity) && v.quantity <= 99999))) throw new Error('Некорректное количество добавок');
      return { supplementId: s.supplementId, valueIds: s.valueIds, ...(s.valueQuantities ? { valueQuantities: s.valueQuantities } : {}) };
    });
    return { id: i.id, quantity: i.quantity, storeId: i.storeId, supplements };
  });
}
export function encodeSharedCart(items: CartItem[]): string {
  const payload = items.map(i => ({
    id: i.product.id, quantity: i.quantity, storeId: i.product.storeId,
    supplements: (i.supplements || []).map((s: any) => ({
      supplementId: s.supplementId,
      valueIds: s.valueIds || s.values?.map((v: any) => v.id) || [],
      ...(s.valueQuantities ? { valueQuantities: s.valueQuantities } : s.values?.some((v: any) => v.isFromCatalog) ? { valueQuantities: s.values.map((v: any) => ({ valueId: v.id, quantity: Math.max(1, Math.round((v.quantity || 1) / Math.max(1, i.quantity / step(i.product)))) })) } : {}),
    })),
  }));
  const encoded = 'v2.' + encodeURIComponent(JSON.stringify({ version: 2, items: payload }));
  parseSharedCart(encoded);
  return encoded;
}

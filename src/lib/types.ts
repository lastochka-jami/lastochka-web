/**
 * Type definitions and normalizers for Lastochka Jami e-commerce store.
 * Replaces loose `any` types with strict DTOs and provides safe normalizers.
 */

export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  total?: number;
  hasMore?: boolean;
  page?: number;
  perPage?: number;
}

export interface Media {
  id?: number;
  path: string;
  thumbPath?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  position?: number;
  isLeaf?: boolean;
  image?: Media | null;
  backgroundImage?: Media | null;
  ancestors?: Category[];
  tagText?: string | null;
  tagColor?: string | null;
}

export interface Store {
  id: number;
  name: string;
  address?: string;
  isActive?: boolean;
  isPickupEnabled?: boolean;
  pickupPaymentMethods?: string[];
  minOrderAmount?: number;
}

export interface Address {
  id: number;
  title?: string;
  country?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  intercom?: string;
  comment?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  storeId?: number;
  store?: Store;
}

export interface SupplementValue {
  id: number;
  title?: string;
  name?: string;
  price?: number;
  isFromCatalog?: boolean;
  quantity?: number;
}

export interface Supplement {
  id: number;
  title: string;
  isRequired?: boolean;
  values: SupplementValue[];
}

export interface ProductVariant {
  id: number;
  title: string;
  price: number;
  stockQuantity: number;
  images?: Media[];
}

export interface Product {
  id: number;
  storeId: number | null;
  title: string;
  slug?: string;
  description?: string;
  price: number;
  priceOld?: number;
  images: Media[];
  preview: string | null;
  quantityStep: number;
  measurementUnit: string;
  measurementUnitLabel: string;
  weight?: number;
  stockQuantity: number;
  isFavorite: boolean;
  isConfigurable: boolean;
  hasSupplements: boolean;
  hasRequiredSupplements: boolean;
  supplements: Supplement[];
  variants?: ProductVariant[];
  composition?: string;
  additionalInfo?: string;
  proteins?: number;
  fats?: number;
  carbohydrates?: number;
  calories?: number;
  rating?: number;
  reviewsCount: number;
  pickupOnly?: boolean;
  availableFrom?: string;
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
}

export interface CartItem {
  id: number;
  quantity: number;
  price?: number;
  product: Product;
  supplements?: Array<{ supplementId: number; valueIds: number[] }> | unknown[];
  stockWarning?: string;
  supplementsTotal?: number;
  transferKey?: string;
  transferStartedAt?: number;
}

export interface CartStoreGroup {
  store: Store;
  items: CartItem[];
  total?: number;
  totalToPay?: number;
  deliveryCost?: number;
  assemblyCost?: number;
  discount?: number;
  promocode?: string | null;
  bonus?: {
    isEnabled?: boolean;
    balance?: number;
    userBalance?: number;
    maxSpend?: number;
    maxEarn?: number;
  };
}

export interface Cart {
  storeGroups?: CartStoreGroup[];
  dateGroups?: { items: CartItem[] }[];
  totalToPay?: number;
  total?: number;
}

export interface DeliverySlot {
  id: number;
  timeSlot: string;
  date?: string;
}

export interface DeliverySlotsData {
  slots: DeliverySlot[];
  availablePaymentMethods?: string[];
}

export interface OrderItemDto {
  id: number;
  quantity: number;
  price: number;
  total?: number;
  title?: string;
  productTitle?: string;
  product?: {
    id: number;
    title: string;
  };
}

export interface OrderDto {
  id: number;
  orderId?: number;
  status: string;
  total: number;
  subtotal?: number;
  discount?: number;
  deliveryCost?: number;
  isPaid?: boolean;
  paymentDeclineReason?: string;
  deliverySlotDate?: string;
  deliverySlotTimeSlot?: string;
  shippingMethod?: string;
  createdAt?: string;
  canCancel?: boolean;
  items?: OrderItemDto[];
  confirmationUrl?: string;
}

export interface LoyaltyCardDto {
  status?: string;
  balance?: number;
  cardNumber?: string;
  qrPayload?: string;
}

export interface BonusTransactionDto {
  id: number;
  amount: number;
  description?: string;
  type?: string;
  createdAt?: string;
}

export interface PaymentCardDto {
  id: number;
  cardType?: string;
  type?: string;
  last4?: string;
  lastFour?: string;
}

export interface NotificationDto {
  shortDescription?: string | null;
  imageUrl?: string | null;
  id: number;
  title: string;
  body?: string;
  text?: string;
  isRead?: boolean;
  createdAt?: string;
}

export interface ReviewDto {
  id: number;
  rating: number;
  text?: string;
  comment?: string;
  userName?: string;
  user?: {
    firstName?: string;
  };
}

export interface AppSettingsDto {
  additionalInfo?: Array<{ key: string; title: string; text?: string }>;
  contacts?: { phones?: string[] };
  checkoutWithoutSlots?: boolean;
  checkoutOptions?: Array<{ code: string; label: string }>;
}

export interface FaqItemDto {
  id: number;
  question: string;
  answer: string;
}

export interface ProductGroupDto {
  id: number;
  title: string;
  slug: string;
  is_recommended?: boolean;
  productsCount?: number;
  image?: Media;
}

export interface BannerDto {
  id: number;
  title: string;
  image?: Media;
  linkType?: string;
  linkProductId?: string | number;
  linkCategoryId?: string | number;
}

export interface StoryDto {
  id: number;
  title: string;
  description?: string;
  text?: string;
  image?: Media;
  preview?: Media;
  videoUrl?: string;
}

export interface UserProfileDto {
  id?: number;
  phone?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  birthDate?: string | null;
  adultConfirmed?: boolean;
}

export interface UserNotificationSettingsDto {
  ordersEnabled?: boolean;
  promoEnabled?: boolean;
  emailEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Normalizers and Utilities
// ---------------------------------------------------------------------------

export const unwrap = <T = any>(v: any): T => {
  if (v && typeof v === 'object' && 'data' in v) {
    return v.data;
  }
  return v;
};

export const list = <T = any>(v: any): T[] => {
  const unwrapped = unwrap(v);
  return Array.isArray(unwrapped) ? unwrapped : [];
};

export const money = (v: unknown): string => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 2,
    }).format(v);
  }
  return '—';
};

export const truth = (v: unknown): boolean => {
  return v === true || v === 1 || v === '1' || v === 'true';
};

export const step = (p: Product): number => {
  return Math.max(1, Number(p.quantityStep) || 1);
};

export const quantityLabel = (p: Product, n: number): string => {
  return `${n} ${p.measurementUnitLabel || 'шт'}`;
};

const validUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value);

function mediaCandidates(v: any): unknown[] {
  if (!v || typeof v !== 'object') return [];
  return [
    v.image,
    v.cover,
    v.preview,
    v.mainImage,
    ...(Array.isArray(v.images) ? v.images : []),
    v.variant?.image,
    ...(Array.isArray(v.variants)
      ? v.variants.flatMap((x: any) => [x?.image, ...(Array.isArray(x?.images) ? x.images : [])])
      : []),
    v.product?.image,
    ...(Array.isArray(v.product?.images) ? v.product.images : []),
  ];
}

export function normalizeMedia(v: any): Media[] {
  const seen = new Set<string>();
  const result: Media[] = [];

  for (const raw of mediaCandidates(v)) {
    const path = typeof raw === 'string' ? raw : (raw as any)?.path;
    if (!validUrl(path) || seen.has(path)) continue;
    seen.add(path);
    result.push({
      ...(typeof raw === 'object' && raw && Number.isFinite(Number((raw as any).id))
        ? { id: Number((raw as any).id) }
        : {}),
      path,
      ...(validUrl((raw as any)?.thumbPath) ? { thumbPath: (raw as any).thumbPath } : {}),
    });
  }

  return result;
}

export function categoryMedia(v: Partial<Category> | any): {
  foreground: string | null;
  background: string | null;
} {
  return {
    foreground: validUrl(v?.image?.path) ? v.image.path : validUrl(v?.image?.thumbPath) ? v.image.thumbPath : null,
    background: validUrl(v?.backgroundImage?.thumbPath) ? v.backgroundImage.thumbPath : validUrl(v?.backgroundImage?.path) ? v.backgroundImage.path : null,
  };
}

export function formatAvailabilityText(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Case 1: String contains ISO datetime or date with time, e.g. "2026-09-20T09:00:00+03:00" or "2026-09-20 09:00:00"
  const isoTimeMatch = trimmed.match(/[T\s](\d{1,2}):(\d{2})/);
  if (isoTimeMatch) {
    const hours = isoTimeMatch[1].padStart(2, '0');
    const minutes = isoTimeMatch[2];
    return `Доступно с ${hours}:${minutes}`;
  }

  // Case 2: Already contains "Доступно с HH:mm" or "Доступно с H:mm"
  const prefixedMatch = trimmed.match(/доступно\s*(?:с)?\s*(\d{1,2}):(\d{2})/i);
  if (prefixedMatch) {
    const hours = prefixedMatch[1].padStart(2, '0');
    const minutes = prefixedMatch[2];
    return `Доступно с ${hours}:${minutes}`;
  }

  // Case 3: Simple time string, e.g. "09:00", "9:00", "09:00:00"
  const simpleTimeMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (simpleTimeMatch) {
    const hours = simpleTimeMatch[1].padStart(2, '0');
    const minutes = simpleTimeMatch[2];
    return `Доступно с ${hours}:${minutes}`;
  }

  // Case 4: Any other time mention
  const anyTimeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (anyTimeMatch) {
    const hours = anyTimeMatch[1].padStart(2, '0');
    const minutes = anyTimeMatch[2];
    return `Доступно с ${hours}:${minutes}`;
  }

  return trimmed.startsWith('Доступно') ? trimmed : `Доступно с ${trimmed}`;
}

export function product(v: any): Product {
  const images = normalizeMedia(v);
  return {
    ...v,
    price: Number(v.price),
    priceOld: v.priceOld ? Number(v.priceOld) : undefined,
    weight: v.weight ? Number(v.weight) : undefined,
    stockQuantity: Number(v.stockQuantity) || 0,
    quantityStep: Math.max(1, Number(v.quantityStep) || 1),
    measurementUnit: v.measurementUnit || 'piece',
    measurementUnitLabel: v.measurementUnitLabel || 'шт',
    images,
    preview: images[0]?.thumbPath || images[0]?.path || null,
    supplements: Array.isArray(v.supplements) ? v.supplements : [],
    variants: Array.isArray(v.variants) ? v.variants : [],
    isFavorite: truth(v.isFavorite),
    isConfigurable: truth(v.isConfigurable),
    hasSupplements: truth(v.hasSupplements),
    hasRequiredSupplements: truth(v.hasRequiredSupplements),
    availableFrom:
      formatAvailabilityText(
        v.availableFrom ||
        v.available_from ||
        v.cookingTimeFrom ||
        v.cooking_time_from ||
        v.cookingTime ||
        v.cooking_time ||
        v.time_from ||
        v.timeFrom,
      ) || undefined,
    reviewsCount: Number(v.reviewsCount) || 0,
  };
}

export function cartItems(cart: Cart | null | undefined): CartItem[] {
  if (!cart) return [];
  if (Array.isArray(cart.storeGroups)) {
    return cart.storeGroups.flatMap((group) => (Array.isArray(group.items) ? group.items : []));
  }
  if (Array.isArray(cart.dateGroups)) {
    return cart.dateGroups.flatMap((group) => (Array.isArray(group.items) ? group.items : []));
  }
  return [];
}

export function cartGroupTotals(group: CartStoreGroup, pickup = false, bonusSpend = 0) {
  const round = (amount: number) => Math.round(amount * 100) / 100;
  const items = round(group.items.reduce((sum, item) => sum + itemAmount(item), 0));
  const delivery = pickup ? 0 : group.deliveryCost ?? 0;
  const assembly = group.assemblyCost ?? 0;
  const discount = group.discount ?? 0;
  return { items, delivery, assembly, discount, total: round(Math.max(0, items + delivery + assembly - discount - bonusSpend)) };
}

export function cartTotal(cart: Cart | null | undefined, pickup = false): number {
  return Math.round((cart?.storeGroups
    ? cart.storeGroups.reduce((sum, group) => sum + cartGroupTotals(group, pickup).total, 0)
    : cartItems(cart).reduce((sum, item) => sum + itemAmount(item), 0)) * 100) / 100;
}

export function cartChange(before: Cart | null | undefined, after: Cart | null | undefined): string | null {
  const oldItems = new Map(cartItems(before).map((item) => [item.id, item]));
  const newItems = new Map(cartItems(after).map((item) => [item.id, item]));

  const removed = [...oldItems.values()]
    .filter((item) => !newItems.has(item.id))
    .map((item) => item.product.title);

  const changed = [...newItems.values()]
    .filter((item) => oldItems.has(item.id) && oldItems.get(item.id)!.quantity !== item.quantity)
    .map((item) => item.product.title);

  if (!removed.length && !changed.length) return null;

  return [
    removed.length ? `Удалены недоступные товары: ${removed.join(', ')}` : '',
    changed.length ? `Изменено количество: ${changed.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

export function activeStoreId(
  sessionStore: number | null | undefined,
  address: Pick<Address, 'storeId' | 'store'> | null | undefined,
  fallback: number,
): number {
  return Number(address?.storeId || address?.store?.id || sessionStore || fallback);
}

export function getCategoryGroupColor(category: Partial<Category> | string): string {
  const slug = typeof category === 'string' ? category : (category.slug || '').toLowerCase();
  const name = typeof category === 'string' ? category : (category.name || '').toLowerCase();
  const text = `${slug} ${name}`;

  // 1. Детское питание: #FDDDE3 (пудровый baby-pink)
  if (
    (text.includes('detsk') || text.includes('детск')) &&
    (text.includes('pit') || text.includes('питан') || text.includes('smes') || text.includes('смес') || text.includes('piure') || text.includes('пюре') || text.includes('kash') || text.includes('каш'))
  ) {
    return '#FDDDE3';
  }

  // 2. Детская гигиена и игрушки: #F1D6F7 (пастельная лаванда)
  if (
    text.includes('igrushk') ||
    text.includes('игрушк') ||
    ((text.includes('detsk') || text.includes('детск')) && (text.includes('gigien') || text.includes('гигиен') || text.includes('uhod') || text.includes('уход')))
  ) {
    return '#F1D6F7';
  }

  // 3. Всё для уборки: #D2E5FC (чистый небесный)
  if (
    text.includes('ubork') ||
    text.includes('уборк') ||
    text.includes('bytov') ||
    text.includes('бытов') ||
    text.includes('chist') ||
    text.includes('чистящ') ||
    text.includes('stirk') ||
    text.includes('стирк')
  ) {
    return '#D2E5FC';
  }

  // 4. Товары для животных: #DEEEC6 (нежная фисташка)
  if (
    text.includes('zhivotn') ||
    text.includes('животн') ||
    text.includes('korm') ||
    text.includes('корм') ||
    text.includes('zootovar') ||
    text.includes('зоо') ||
    text.includes('кошек') ||
    text.includes('собак')
  ) {
    return '#DEEEC6';
  }

  // 5. Красота и гигиена: #F0D5FA (лиловая орхидея)
  if (
    text.includes('krasot') ||
    text.includes('красот') ||
    text.includes('gigien') ||
    text.includes('гигиен') ||
    text.includes('kosmetik') ||
    text.includes('косметик') ||
    text.includes('uhod') ||
    text.includes('уход')
  ) {
    return '#F0D5FA';
  }

  // 6. Для дома и дачи: #D0F2E5 (пастельный мятный)
  if (
    text.includes('dach') ||
    text.includes('дач') ||
    text.includes('posud') ||
    text.includes('посуд') ||
    text.includes('sad') ||
    text.includes('сад') ||
    (text.includes('dom') && !text.includes('vedom')) ||
    text.includes('для дома')
  ) {
    return '#D0F2E5';
  }

  // 7. Выпечка, хлеб: #FDE6D2 (песочно-пшеничный)
  if (
    text.includes('xleb') ||
    text.includes('хлеб') ||
    text.includes('buloc') ||
    text.includes('булоч') ||
    text.includes('vypech') ||
    text.includes('выпеч') ||
    text.includes('pekarn') ||
    text.includes('пекарн') ||
    text.includes('lavash') ||
    text.includes('лаваш') ||
    text.includes('lepeshk') ||
    text.includes('лепешк')
  ) {
    return '#FDE6D2';
  }

  // 8. Готовая еда (кулинария, салаты, фастфуд, мангал): #FEE8CE (теплый абрикосово-кремовый)
  if (
    text.includes('gotov') ||
    text.includes('готов') ||
    text.includes('kulinari') ||
    text.includes('кулинар') ||
    text.includes('salat') ||
    text.includes('салат') ||
    text.includes('mangal') ||
    text.includes('мангал') ||
    text.includes('fastfud') ||
    text.includes('фастфуд') ||
    text.includes('khychin') ||
    text.includes('хычин') ||
    text.includes('pirog') ||
    text.includes('пирог') ||
    text.includes('solen') ||
    text.includes('солень') ||
    text.includes('bliuda') ||
    text.includes('блюд')
  ) {
    return '#FEE8CE';
  }

  // 9. Овощи, фрукты, зелень: #D4F2A3 (свежий салатовый)
  if (
    text.includes('ovosh') ||
    text.includes('овощ') ||
    text.includes('frukt') ||
    text.includes('фрукт') ||
    text.includes('zelen') ||
    text.includes('зелен') ||
    text.includes('grib') ||
    text.includes('гриб') ||
    text.includes('iagod') ||
    text.includes('ягод') ||
    text.includes('suhofrukt') ||
    text.includes('сухофрукт')
  ) {
    return '#D4F2A3';
  }

  // 10. Мясо, птица, колбасы: #FDDCD7 (лососево-розовый)
  if (
    text.includes('mias') ||
    text.includes('мясо') ||
    text.includes('мясн') ||
    text.includes('ptic') ||
    text.includes('птиц') ||
    text.includes('kolbas') ||
    text.includes('колбас') ||
    text.includes('sosisk') ||
    text.includes('сосиск') ||
    text.includes('krolik') ||
    text.includes('кролик') ||
    text.includes('holodec') ||
    text.includes('холодец')
  ) {
    return '#FDDCD7';
  }

  // 11. Рыба и морепродукты: #CCF2EE (морская мята)
  if (
    text.includes('ryb') ||
    text.includes('рыб') ||
    text.includes('moreprodukt') ||
    text.includes('морепродукт') ||
    text.includes('ikra') ||
    text.includes('икра')
  ) {
    return '#CCF2EE';
  }

  // 12. Сладкое, торты, конфеты: #FCE1ED (розовый зефир)
  if (
    text.includes('sladk') ||
    text.includes('сладк') ||
    text.includes('tort') ||
    text.includes('торт') ||
    text.includes('konfet') ||
    text.includes('конфет') ||
    text.includes('shokolad') ||
    text.includes('шоколад') ||
    text.includes('desert') ||
    text.includes('десерт') ||
    text.includes('pechen') ||
    text.includes('печень') ||
    text.includes('med') ||
    text.includes('мёд') ||
    text.includes('мед') ||
    text.includes('varen') ||
    text.includes('варень') ||
    text.includes('zefir') ||
    text.includes('зефир') ||
    text.includes('ledenc') ||
    text.includes('леденц')
  ) {
    return '#FCE1ED';
  }

  // 13. Заморозка, мороженое: #D0F0FD (ледяной голубой)
  if (
    text.includes('zamoroz') ||
    text.includes('замороз') ||
    text.includes('morozhen') ||
    text.includes('морожен') ||
    text.includes('pelmen') ||
    text.includes('пельмен') ||
    text.includes('varenik') ||
    text.includes('вареник') ||
    text.includes('mant') ||
    text.includes('мант') ||
    text.includes('testo') ||
    text.includes('тесто') ||
    text.includes('galushk') ||
    text.includes('галушк') ||
    text.includes('blin') ||
    text.includes('блин') ||
    text.includes('cheburek') ||
    text.includes('чебурек')
  ) {
    return '#D0F0FD';
  }

  // 14. Вода, соки, напитки: #CEE5FD (пастельный васильковый)
  if (
    text.includes('voda') ||
    text.includes('вод') ||
    text.includes('sok') ||
    text.includes('сок') ||
    text.includes('napitk') ||
    text.includes('напитк') ||
    text.includes('mors') ||
    text.includes('морс')
  ) {
    return '#CEE5FD';
  }

  // 15. Чай, кофе, какао: #EFE4D6 (кофейно-молочный беж)
  if (
    text.includes('cai') ||
    text.includes('chay') ||
    text.includes('чай') ||
    text.includes('kofe') ||
    text.includes('кофе') ||
    text.includes('kakao') ||
    text.includes('какао') ||
    text.includes('cikor') ||
    text.includes('цикорий') ||
    text.includes('kisel') ||
    text.includes('кисель')
  ) {
    return '#EFE4D6';
  }

  // 16. Снеки, чипсы: #FEE5C2 (теплый персиковый)
  if (
    text.includes('snek') ||
    text.includes('снек') ||
    text.includes('cips') ||
    text.includes('chips') ||
    text.includes('чипс') ||
    text.includes('suharik') ||
    text.includes('сухарик') ||
    text.includes('popkorn') ||
    text.includes('попкорн') ||
    text.includes('kukuruz') ||
    text.includes('кукуруз') ||
    text.includes('oreh') ||
    text.includes('орех') ||
    text.includes('semech') ||
    text.includes('семеч') ||
    text.includes('arahis') ||
    text.includes('арахис')
  ) {
    return '#FEE5C2';
  }

  // 17. Бакалея, макароны, консервы, масло: #FEF2BF (сливочно-желтый)
  if (
    text.includes('bakale') ||
    text.includes('бакале') ||
    text.includes('makaron') ||
    text.includes('макарон') ||
    text.includes('krup') ||
    text.includes('круп') ||
    text.includes('garnir') ||
    text.includes('гарнир') ||
    text.includes('konserv') ||
    text.includes('консерв') ||
    text.includes('maslo') ||
    text.includes('масло') ||
    text.includes('sous') ||
    text.includes('соус') ||
    text.includes('maionez') ||
    text.includes('майонез') ||
    text.includes('muka') ||
    text.includes('мука') ||
    text.includes('sahar') ||
    text.includes('сахар') ||
    text.includes('speci') ||
    text.includes('специ') ||
    text.includes('zavtrak') ||
    text.includes('завтрак') ||
    text.includes('kash') ||
    text.includes('каш') ||
    text.includes('xlop') ||
    text.includes('хлопь')
  ) {
    return '#FEF2BF';
  }

  // Дефолтный фон для прочих категорий: #F6EEE3 (мягкий нейтральный крем)
  return '#F6EEE3';
}

/** Prices are per portion; quantity is stored in the product's cart units. */
export function itemAmount(item: Pick<CartItem, 'product' | 'quantity' | 'price' | 'supplements' | 'supplementsTotal'>): number {
  const portions = Math.floor(item.quantity / step(item.product));
  let extras = item.supplementsTotal;
  if (extras === undefined) {
    extras = (item.supplements || []).reduce<number>((sum, raw: any) => {
      const definition = item.product.supplements?.find(s => s.id === raw.supplementId);
      const ids = raw.valueIds || raw.values?.map((v: any) => v.id) || [];
      return sum + ids.reduce((n: number, id: number) => {
        const value = definition?.values.find(v => v.id === id);
        const count = raw.valueQuantities?.find((v: any) => v.valueId === id)?.quantity ?? 1;
        return n + Number(value?.price || 0) * count;
      }, 0) * portions;
    }, 0);
  }
  return Math.round(((item.price ?? item.product.price ?? 0) * portions + extras) * 100) / 100;
}

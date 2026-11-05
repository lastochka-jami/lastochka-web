'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBasket,
  Trash2,
  Share2,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  CreditCard,
  Truck,
  Store as StoreIcon,
  Plus,
  Minus,
} from 'lucide-react';
import { useShop, AuthGate } from '@/components/shop-context';
import { Photo, Empty, ErrorMessage, Modal } from '@/components/ui';
import { ShareCartModal } from '@/components/share-cart-modal';
import { paymentReturnUrl, request } from '@/lib/client';
import {
  Cart,
  CartItem,
  CartStoreGroup,
  Address,
  money,
  list,
  unwrap,
  product,
  truth,
  Product,
  itemAmount,
  cartGroupTotals,
  formatAvailabilityText,
} from '@/lib/types';
import { useRemote } from './account/hooks/use-remote';
import { goPayment } from './account/orders/orders-view';
import { activateDeliveryAddressForStore } from '@/components/location-sheet';
import { announceLocation, readLocation, LOCATION_CHANGED_EVENT, type LocationSelection } from '@/lib/fulfillment';
import { clearGuestCart, getGuestCart, mergeGuestCartToServer } from '@/lib/guest-cart';

export function CartPage() {
  return <CartContent />;
}

function CartContent() {
  const s = useShop();
  const router = useRouter();
  const addressesRemote = useRemote<Address[]>(s.authenticated ? 'addresses' : null);
  const settingsRemote = useRemote<any>('app-settings');

  const mode = s.locationMode === 'pickup' ? 'pickup' : 'courier';
  const [addressId, setAddressId] = useState('');
  const [guestAddress, setGuestAddress] = useState({
    city: 'Нальчик',
    street: '',
    house: '',
    apartment: '',
  });

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
  const [date, setDate] = useState(todayStr);
  const [slot, setSlot] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [payment, setPayment] = useState('card');
  const [comment, setComment] = useState('');
  const [promo, setPromo] = useState('');
  const [busy, setBusy] = useState(false);
  const [bonus, setBonus] = useState<'earn' | 'spend'>('earn');
  const [spend, setSpend] = useState('');
  const [reviewModal, setReviewModal] = useState<any>();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const lock = useRef(false);

  const cart = s.cart;
  const groups: CartStoreGroup[] = cart?.storeGroups || [];
  const [selectedStore, setSelectedStore] = useState<number>();
  const group = groups.find(g => g.store.id === (selectedStore || s.storeId)) || groups[0];
  const storeId = group?.store?.id || s.storeId;

  const appSettings = unwrap<any>(settingsRemote.data);

  // Delivery slot endpoint
  const slotPath =
    storeId && (mode === 'pickup' || addressId || !s.authenticated)
      ? `stores/${storeId}/${mode === 'pickup' ? 'pickup' : 'delivery'}-slots?date=${date}${
          mode === 'courier' && addressId ? '&addressId=' + addressId : ''
        }`
      : null;

  const slotsRemote = useRemote<any>(s.authenticated && slotPath ? slotPath + "&cartVersion=" + encodeURIComponent(JSON.stringify(cart?.storeGroups?.map(g => g.items.map(i => [i.id, i.quantity, i.supplements])))) : null);
  const slotData = unwrap<any>(slotsRemote.data);

  // Featured upsell dishes ("Фирменные блюда")
  const featuredRemote = useRemote<any>(storeId ? `product-groups/3/products?storeId=${storeId}&perPage=8` : null);
  const featuredProducts = list(featuredRemote.data).map(product);

  const paymentMethods =
    mode === 'pickup'
      ? group?.store?.pickupPaymentMethods
      : slotData?.availablePaymentMethods;

  const items: CartItem[] = group?.items || [];
  const cartVersion = JSON.stringify(items.map(i => [i.id, i.quantity, i.supplements]));

  const bonusSpend = bonus === 'spend' ? Math.min(group?.bonus?.maxSpend || 0, group?.bonus?.userBalance || 0, Math.max(0, Math.floor(Number(spend) || 0))) : 0;
  const totals = group ? cartGroupTotals(group, mode === 'pickup', bonusSpend) : { items: 0, total: 0 };
  const calculatedItemsTotal = totals.items;
  const total = totals.total;

  useEffect(() => {
    const update = (selection: LocationSelection) => {
      if (selection.storeId) setSelectedStore(selection.storeId);
      setAddressId(selection.mode === 'delivery' && selection.addressId ? String(selection.addressId) : '');
    };
    update(readLocation());
    const changed = (event: Event) => update((event as CustomEvent<LocationSelection>).detail);
    window.addEventListener(LOCATION_CHANGED_EVENT, changed);
    return () => window.removeEventListener(LOCATION_CHANGED_EVENT, changed);
  }, []);
  useEffect(() => { setSlot(''); setReviewModal(undefined); }, [date, cartVersion]);
  useEffect(() => {
    if (!paymentMethods?.includes(payment)) setPayment(paymentMethods?.[0] || '');
  }, [JSON.stringify(paymentMethods), payment]);

  useEffect(() => {
    if (s.authenticated && addressesRemote.data) {
      const active = list<Address>(addressesRemote.data).find((a) => a.isActive);
      if (active && !addressId) {
        setAddressId(String(active.id));
      }
    }
  }, [addressesRemote.data, addressId, s.authenticated]);

  useEffect(() => { setSlot(''); setReviewModal(undefined); }, [mode, addressId, storeId]);

  async function changeMode(next: 'delivery' | 'pickup') {
    await s.run(async () => {
      if (next === 'pickup') {
        if (group?.store?.isPickupEnabled !== true) throw new Error('Самовывоз в этом магазине недоступен');
        if (storeId !== s.storeId) await request('/api/store', 'POST', { storeId });
        announceLocation({ mode: 'pickup', storeId, label: group.store.address || group.store.name });
      } else if (s.authenticated && addressId) {
        const address = list<Address>(addressesRemote.data).find(item => item.id === Number(addressId));
        await activateDeliveryAddressForStore(Number(addressId), storeId, address && [address.city, address.street, address.houseNumber].filter(Boolean).join(', '));
      } else {
        announceLocation({ mode: 'delivery' });
      }
    });
  }

  async function handleClearCart() {
    if (items.some(i => i.transferKey)) { s.reportError('Сначала повторите перенос: ответ по некоторым позициям не получен.'); return; }
    if (!confirm('Удалить все товары из корзины?')) return;
    if (s.authenticated) {
      await s.run(async () => {
        await request('cart', 'DELETE');
        await s.refresh();
      });
    } else {
      clearGuestCart();
      await s.refresh();
      s.notice('Корзина очищена');
    }
  }

  function handleShare() {
    if (!items.length) {
      s.reportError('В вашей корзине пока нет товаров');
      return;
    }
    setShareModalOpen(true);
  }

  async function prepareOrder(e?: React.FormEvent) {
    if (e) e.preventDefault();
    s.notice('Магазин пока не передаёт подтверждённый итог. Оформление недоступно; корзина сохранена.');
  }

  async function submitFinalOrder() {
    if (!s.checkoutEnabled || lock.current || !reviewModal) return;
    lock.current = true;
    setBusy(true);

    try {
      await s.run(async () => {
        const current = unwrap<Cart>(
          await request(`cart?shippingMethod=${mode}${addressId ? '&addressId=' + addressId : ''}`),
        );

        if (JSON.stringify(current) !== JSON.stringify(reviewModal.cart)) {
          await s.refresh();
          setReviewModal(undefined);
          throw new Error('Данные корзины изменились. Проверьте позиции и сумму.');
        }

        const payload = {
          storeId,
          addressId: mode === 'courier' ? Number(addressId) : null,
          shippingMethod: mode,
          deliverySlotId: slot ? Number(slot) : null,
          comment,
          paymentType: payment,
          bonusAction: bonus,
          ...(bonus === 'spend' ? { bonusSpendAmount: Math.round(Number(spend)) } : {}),
          checkoutOptions: selectedOptions,
          returnUrl: paymentReturnUrl('/payment', s.publicOrigin),
        };

        const fingerprint = JSON.stringify(payload);
        let pending: any = null;
        try {
          pending = JSON.parse(sessionStorage.getItem('pending-order') || 'null');
        } catch {
          // Ignore
        }

        const idempotencyKey =
          pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
        sessionStorage.setItem('pending-order', JSON.stringify({ key: idempotencyKey, fingerprint }));

        const orderResult = await request<any>('orders', 'POST', {
          ...payload,
          idempotencyKey,
        });

        sessionStorage.removeItem('pending-order');
        sessionStorage.setItem('last-order', String(orderResult.orderId));
        await s.refresh();

        if (orderResult.confirmationUrl) {
          goPayment(orderResult.confirmationUrl);
        } else {
          router.push('/orders/' + orderResult.orderId);
        }
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!cart) {
    return s.cartError ? <ErrorMessage message={s.cartError} retry={s.refresh} /> : <p className="muted">Загружаем корзину…</p>;
  }

  const retainedItems = s.authenticated ? (getGuestCart().storeGroups || []).flatMap(g => g.items) : [];
  const transferPanel = retainedItems.length > 0 ? <div className="panel stack">
    <p>На устройстве сохранены неперенесённые товары:</p>
    <ul>{retainedItems.map(i => <li key={i.id}>{i.product.title}: {i.quantity} {i.product.measurementUnitLabel}</li>)}</ul>
    <button className="secondary" type="button" onClick={() => s.run(async () => {
      const result = await mergeGuestCartToServer();
      if (result.remaining) s.reportError(`Перенесено: ${result.accepted}, осталось на устройстве: ${result.remaining}. Повторите перенос; если срок повтора истёк, свяжитесь с магазином.`);
      else s.notice('Все сохранённые товары перенесены');
      await s.refresh();
    })}>Повторить перенос сохранённых товаров</button>
  </div> : null;

  if (!items.length) {
    return (
      <Empty headingLevel={1} title={retainedItems.length ? "Не все товары перенесены" : "В корзине пока пусто"}>
        {transferPanel}
        <p>Добавьте любимые продукты, свежую выпечку или готовые блюда.</p>
        <Link className="primary" href="/catalog">
          Перейти в каталог
        </Link>
      </Empty>
    );
  }

function formatRub(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const hasDecimals = v % 1 !== 0;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(v);
  }
  return '—';
}

  const selectedSlotObj = slotData?.slots?.find((sItem: any) => String(sItem.id) === String(slot));
  const timeBannerText = selectedSlotObj
    ? `${date === todayStr ? 'Сегодня' : date}, ${selectedSlotObj.timeSlot}`
    : 'Выберите время';

  // Common payment and summary elements to share between mobile view and desktop sidebar
  const paymentSection = (
    <div className="cart-payment-section">
      <h3>Способ оплаты</h3>
      <div className="cart-payment-list">
        {(paymentMethods || []).map((pMethod: string) => {
          const isSelected = payment === pMethod;
          return (
            <button
              key={pMethod}
              type="button"
              className={`cart-payment-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setPayment(pMethod)}
            >
              <div className="cart-payment-left">
                <div className="cart-payment-icon-wrap">
                  <CreditCard size={18} />
                </div>
                <span>{pMethod === 'card' ? 'Выберите карту' : 'Наличными при получении'}</span>
              </div>
              <div className={`cart-payment-radio ${isSelected ? 'checked' : ''}`}>
                {isSelected ? <CheckCircle2 size={20} /> : <div className="cart-empty-circle" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const summarySection = (
    <div className="cart-summary-block">
      <div className="cart-summary-line">
        <span>Товары</span>
        <span>{formatRub(calculatedItemsTotal)}</span>
      </div>
      <div className="cart-summary-line">
        <span>Сборка</span>
        <span>{typeof group?.assemblyCost === "number" ? formatRub(group.assemblyCost) : "Уточняется"}</span>
      </div>
      {mode === 'courier' && typeof group?.deliveryCost === 'number' && group.deliveryCost > 0 && (
        <div className="cart-summary-line">
          <span>Доставка</span>
          <span>{formatRub(group.deliveryCost)}</span>
        </div>
      )}
      {typeof group?.discount === 'number' && group.discount > 0 && (
        <div className="cart-summary-line">
          <span>Скидка</span>
          <span className="cart-summary-discount-val">−{formatRub(group.discount)}</span>
        </div>
      )}
      {group?.store?.minOrderAmount && calculatedItemsTotal < group.store.minOrderAmount ? <p className="muted">Минимальная сумма товаров: {money(group.store.minOrderAmount)}</p> : null}
      <div className="cart-summary-line-divider" />
      <div className="cart-summary-total-line">
        <strong>Предварительная оценка</strong>
        <strong className="cart-summary-total-amount">{formatRub(total)}</strong>
      </div>
      <div className="cart-summary-points-hint">
        {group?.bonus?.maxEarn !== undefined ? `Можно получить до ${group.bonus.maxEarn} бонусов` : "Точный итог, доставка и скидки уточняются магазином"}
      </div>
    </div>
  );

  const ctaSection = (
    <div className="cart-cta-section">
      <button
        className="primary cart-main-cta-btn"
        disabled={true}
        type="submit"
      >
        Оформление недоступно
      </button>
      {s.checkoutEnabled && <button
        type="button"
        className="cart-terms-agreement-row"
        onClick={() => setTermsAgreed(!termsAgreed)}
      >
        <div className={`cart-terms-check ${termsAgreed ? 'checked' : ''}`}>
          {termsAgreed ? <CheckCircle2 size={18} /> : <div className="cart-empty-circle-sm" />}
        </div>
        <span>
          Я согласен с{' '}
          <Link href="/info" className="cart-terms-link" onClick={(e) => e.stopPropagation()}>
            условиями использования
          </Link>{' '}
          и{' '}
          <Link href="/info" className="cart-terms-link" onClick={(e) => e.stopPropagation()}>
            публичной офертой
          </Link>
        </span>
      </button>}
      {!s.authenticated && <button type="button" className="text-button" onClick={s.login}>Войти, чтобы перенести корзину</button>}
    </div>
  );

  return (
    <div className="cart-page-container">
      {/* Top Header matching reference */}
      <div className="cart-top-bar">
        <button
          type="button"
          className="cart-header-back-btn"
          onClick={() => router.back()}
          aria-label="Назад"
        >
          <ChevronLeft size={24} />
        </button>
        <h1>Корзина</h1>
        <div className="cart-header-actions">
          <button
            type="button"
            className="cart-header-icon-btn"
            onClick={handleShare}
            aria-label="Поделиться корзиной"
            title="Поделиться"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            className="cart-header-icon-btn"
            onClick={handleClearCart}
            aria-label="Очистить корзину"
            title="Очистить корзину"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {groups.length > 1 && <label>Магазин корзины<select value={storeId} onChange={e => setSelectedStore(Number(e.target.value))}>{groups.map(g => <option key={g.store.id} value={g.store.id}>{g.store.name}</option>)}</select></label>}
      {transferPanel}
      {s.cartError && <ErrorMessage message={s.cartError} retry={s.refresh} />}
      <p className="notice-banner">Предварительная оценка. Онлайн-оформление временно недоступно.</p>
      <form onSubmit={prepareOrder} className="cart-form-root">
        <div className="cart-layout-two-column">
          {/* Left / Main Column */}
          <div className="cart-left-column">
            {/* Mode Switcher: Доставка / Самовывоз */}
            <div className="cart-mode-selector">
              <button
                type="button"
                className={`cart-mode-pill ${mode === 'courier' ? 'active' : ''}`}
                onClick={() => void changeMode('delivery')}
              >
                Доставка
              </button>
              {group?.store?.isPickupEnabled === true && (
                <button
                  type="button"
                  className={`cart-mode-pill ${mode === 'pickup' ? 'active' : ''}`}
                  onClick={() => void changeMode('pickup')}
                >
                  Самовывоз
                </button>
              )}
            </div>

            {/* Time Slot Banner */}
            <div className="cart-time-banner-wrap">
              <button
                type="button"
                className="cart-time-banner"
                onClick={() => setShowTimePicker(!showTimePicker)}
              >
                <div className="cart-time-banner-left">
                  <Clock size={20} className="cart-time-banner-clock" />
                  <span className="cart-time-banner-text">{timeBannerText}</span>
                </div>
                <ChevronRight
                  size={20}
                  className={`cart-time-banner-arrow ${showTimePicker ? 'open' : ''}`}
                />
              </button>

              {slotsRemote.error && <ErrorMessage message={slotsRemote.error} retry={slotsRemote.reload} />}
              {addressesRemote.error && <ErrorMessage message={addressesRemote.error} retry={addressesRemote.reload} />}
              {showTimePicker && (
                <div className="cart-time-dropdown panel stack">
                  <div className="two-fields date-time-grid">
                    <label>
                      Дата
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Интервал
                      <select
                        value={slot}
                        onChange={(e) => {
                          setSlot(e.target.value);
                          if (e.target.value) setShowTimePicker(false);
                        }}
                        required={!appSettings?.checkoutWithoutSlots}
                        disabled={!s.authenticated}
                      >
                        <option value="">
                          {!s.authenticated
                            ? 'Будет выбран при подтверждении'
                            : slotsRemote.loading
                              ? 'Загружаем интервалы…'
                              : 'Выберите время'}
                        </option>
                        {slotData?.slots?.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.timeSlot}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Address selector / info */}
            {mode === 'courier' ? (
              <div className="cart-address-compact panel">
                {s.authenticated ? (
                  <div className="cart-address-selector-row">
                    <MapPin size={18} className="cart-address-icon" />
                    <select
                      value={addressId}
                      onChange={e => { const next = e.target.value; if (!next) { setAddressId(''); return; } void s.run(async () => { const result = await activateDeliveryAddressForStore(Number(next), storeId, list<Address>(addressesRemote.data).filter(a => a.id === Number(next)).map(a => [a.city, a.street, a.houseNumber].filter(Boolean).join(', '))[0]); setAddressId(next); setSelectedStore(result.store.id); await s.refresh(); }); }}
                      className="cart-address-select"
                      required
                    >
                      <option value="">Выберите адрес доставки</option>
                      {list<Address>(addressesRemote.data).map((a) => (
                        <option key={a.id} value={a.id}>
                          {[a.city, a.street, a.houseNumber, a.apartment && `кв. ${a.apartment}`]
                            .filter(Boolean)
                            .join(', ')}
                        </option>
                      ))}
                    </select>
                    <Link href="/addresses" className="cart-address-add-link" title="Добавить адрес">
                      +
                    </Link>
                  </div>
                ) : (
                  <p className="muted">Войдите, чтобы выбрать сохранённый адрес доставки. Гостевая корзина хранится на этом устройстве.</p>
                )}
              </div>
            ) : (
              <div className="cart-pickup-compact panel">
                <MapPin size={18} className="cart-address-icon" />
                <div>
                  <strong>{group?.store?.name || 'Магазин «Ласточка»'}</strong>
                  <p className="muted">{group?.store?.address || 'Уточните адрес магазина'}</p>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="cart-items-wrapper">
              {[group].filter(Boolean).map((g) => (
                <section className="cart-items-group" key={g.store.id}>
                  <div className="cart-items-list">
                    {g.items.map((i) => {
                      const normalized = product(i.product);
                      const unitPrice = i.price ?? normalized.price;
                      const itemTotal = itemAmount(i);
                      const stepVal = Number(normalized.quantityStep) || 1;
                      const unitName = (normalized.measurementUnitLabel || 'шт').replace(/^[0-9.]+\s*/, '') || 'шт';

                      return (
                        <article className="cart-item-row" key={i.id}>
                          <Link href={'/product/' + normalized.id} className="cart-item-thumb">
                            <Photo src={normalized.preview || undefined} alt={normalized.title} />
                          </Link>

                          <div className="cart-item-middle">
                            <Link href={'/product/' + normalized.id} className="cart-item-name">
                              {normalized.title}
                            </Link>
                            <div className="cart-item-unit-badge">
                              {formatRub(unitPrice)} / {stepVal > 1 ? `${stepVal} ` : ''}{normalized.measurementUnitLabel}
                            </div>
                            {i.supplements?.length ? <p className="muted">{i.supplements.map((raw: any) => {
                              const definition = normalized.supplements.find(v => v.id === raw.supplementId);
                              return (raw.values || definition?.values.filter(v => raw.valueIds?.includes(v.id)) || []).map((v: any) => v.title || v.name).join(', ');
                            }).filter(Boolean).join('; ')}</p> : null}
                            {i.stockWarning && <p className="error">{i.stockWarning}</p>}
                          </div>

                          <div className="cart-item-right">
                            <div className="cart-item-bold-price">{formatRub(itemTotal)}</div>
                            <div className="cart-item-stepper">
                              <button
                                type="button"
                                aria-label="Уменьшить"
                                onClick={() =>
                                  s.setQuantity(i.id, Math.max(0, i.quantity - stepVal), normalized)
                                }
                              >
                                <Minus size={13} />
                              </button>
                              <span className="cart-item-stepper-val">
                                {i.quantity} {unitName}
                              </span>
                              <button
                                type="button"
                                aria-label="Увеличить"
                                onClick={() =>
                                  s.setQuantity(i.id, i.quantity + stepVal, normalized)
                                }
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="cart-item-remove"
                              aria-label={`Удалить ${normalized.title} из корзины`}
                              onClick={() => s.setQuantity(i.id, 0)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                              Удалить
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {/* Comment to packer */}
            <div className="cart-comment-card">
              <label htmlFor="cart-comment-text" className="cart-comment-label">
                Комментарий сборщику
              </label>
              <textarea
                id="cart-comment-text"
                className="cart-comment-textarea"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Пиццу очень ждём тёпленькой! :)"
                maxLength={1000}
              />
            </div>

            {/* Free Packaging Banner */}
            <div className="cart-packaging-banner">
              <div className="cart-packaging-content">
                <strong>Мы всё аккуратно упакуем в пакеты</strong>
                <p>Стоимость упаковки уточняется магазином.</p>
              </div>
              <div className="cart-packaging-image">
                <img src="/shop/images/swallow.webp" alt="Ласточка" width={68} height={54} />
              </div>
            </div>

            {/* Promo code */}
            <div className="cart-promo-card">
              <div className="cart-promo-input-row">
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="У меня есть промокод!"
                  maxLength={50}
                />
                {promo.trim() && (
                  <button
                    type="button"
                    className="cart-promo-apply-btn"
                    onClick={() =>
                      s.run(async () => {
                        await request('cart/promocode', 'POST', {
                          storeId,
                          promocode: promo,
                        });
                        await s.refresh();
                        s.notice('Промокод применён');
                      })
                    }
                  >
                    Применить
                  </button>
                )}
              </div>
              {group?.promocode && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    s.run(async () => {
                      await request('cart/promocode?storeId=' + storeId, 'DELETE');
                      await s.refresh();
                    })
                  }
                >
                  Удалить применённый промокод
                </button>
              )}
            </div>

            {/* Checkout Options ("Позвонить если товара нет в наличии") */}
            {Array.isArray(appSettings?.checkoutOptions) &&
              appSettings.checkoutOptions.map((o: any) => {
                const isSelected = selectedOptions.includes(o.code);
                return (
                  <button
                    key={o.code}
                    type="button"
                    className={`cart-option-pill-card ${isSelected ? 'active' : ''}`}
                    onClick={() =>
                      setSelectedOptions(
                        isSelected
                          ? selectedOptions.filter((x) => x !== o.code)
                          : [...selectedOptions, o.code],
                      )
                    }
                  >
                    <span>{o.label}</span>
                    <div className={`cart-option-check-circle ${isSelected ? 'checked' : ''}`}>
                      {isSelected ? <CheckCircle2 size={20} /> : <div className="cart-empty-circle" />}
                    </div>
                  </button>
                );
              })}

            {/* Featured Upsell Carousel ("Фирменные блюда >") */}
            {featuredProducts.length > 0 && (
              <section className="cart-upsell-section">
                <Link href="/collection/firmennye-bliuda" className="cart-upsell-header">
                  <h2>Фирменные блюда</h2>
                  <ChevronRight size={20} />
                </Link>
                <div className="cart-upsell-track">
                  {featuredProducts.map((fp: Product) => {
                    const norm = fp;
                    return (
                      <article key={norm.id} className="cart-upsell-card">
                        <div className="cart-upsell-image-wrap">
                          <Photo src={norm.preview || undefined} alt={norm.title} />
                          {norm.availableFrom && (
                            <span className="cart-upsell-avail-badge compact-availability">
                              <Clock size={10} /> {formatAvailabilityText(norm.availableFrom)}
                            </span>
                          )}
                        </div>
                        <Link href={`/product/${norm.id}`} className="cart-upsell-name">
                          {norm.title}
                        </Link>
                        <span className="cart-upsell-measure">
                          {norm.quantityStep ? `${norm.quantityStep} ${norm.measurementUnitLabel}` : norm.measurementUnitLabel}
                        </span>
                        <div className="cart-upsell-btn-wrap">
                          <button
                            type="button"
                            className="cart-upsell-add-btn"
                            onClick={() => void s.add(norm)}
                            aria-label={`Добавить ${norm.title}`}
                          >
                            <span>{money(norm.price)}</span>
                            <Plus size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

              {/* Bonus Earn / Spend */}
              {s.authenticated && group?.bonus?.isEnabled && (
                <div className="bonus-checkout-block">
                  <div className="segmented">
                    <button
                      type="button"
                      className={bonus === 'earn' ? 'selected' : ''}
                      onClick={() => setBonus('earn')}
                    >
                      Копить бонусы
                    </button>
                    <button
                      type="button"
                      className={bonus === 'spend' ? 'selected' : ''}
                      onClick={() => setBonus('spend')}
                    >
                      Списать бонусы
                    </button>
                  </div>

                  {bonus === 'spend' && (
                    <label className="spend-bonuses-input">
                      Списать бонусов (доступно: {Math.min(group.bonus?.userBalance || 0, group.bonus?.maxSpend || 0)})
                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={Math.min(group.bonus?.userBalance || 0, group.bonus?.maxSpend || 0)}
                        value={spend}
                        onChange={(e) => setSpend(e.target.value)}
                        required
                      />
                    </label>
                  )}
                </div>
              )}

            {/* On mobile: Payment, Summary and CTA follow right in column */}
            <div className="cart-mobile-bottom-flow">
              {paymentSection}
              {summarySection}
              {ctaSection}
            </div>
          </div>

          {/* Right Column (Sticky on Desktop) */}
          <div className="cart-right-column">
            <div className="sticky-order-summary panel">
              {paymentSection}


              {summarySection}
              {ctaSection}

              <div className="security-notice">
                <ShieldCheck size={16} />
                <span>Безопасная оплата картой или при получении</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Review Modal */}
      {reviewModal && (
        <Modal title="Подтверждение заказа" onClose={() => setReviewModal(undefined)}>
          <div className="stack confirm-order-modal">
            <h2>Сумма заказа: {money(reviewModal.total)}</h2>
            <p>
              Данные и цены корзины проверены магазином.
              {payment === 'card'
                ? ' После нажатия кнопки откроется защищённая платёжная страница.'
                : ' Оплата будет произведена наличными курьеру при получении.'}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={submitFinalOrder}
              type="button"
            >
              {busy ? 'Оформляем…' : 'Подтвердить и завершить заказ'}
            </button>
          </div>
        </Modal>
      )}

      <ShareCartModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        items={items.map(i => ({ ...i, product: { ...i.product, storeId } }))}
      />
    </div>
  );
}

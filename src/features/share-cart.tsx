'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBasket, ArrowRight, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useShop } from '@/components/shop-context';
import { request } from '@/lib/client';
import { product, Product, money, unwrap, step, itemAmount, quantityLabel } from '@/lib/types';
import { addGuestCartItem, saveGuestCart, getGuestCart } from '@/lib/guest-cart';
import { parseSharedCart, SharedItem } from '@/lib/shared-cart';
import { Photo } from '@/components/ui';

interface ShareItem extends SharedItem { product?: Product; }

export function ShareCartView() {
  const router = useRouter();
  const s = useShop();

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [items, setItems] = useState<ShareItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let hash = window.location.hash.replace(/^#/, '').trim();
    if (!hash) {
      const urlParams = new URLSearchParams(window.location.search);
      hash = (urlParams.get('items') || '').trim();
    }

    if (!hash) {
      setError('Ссылка на корзину пуста или содержит неверный формат');
      setLoading(false);
      return;
    }

    let parsed: ShareItem[];
    try { parsed = parseSharedCart(hash); }
    catch (e) { setError((e as Error).message); setLoading(false); return; }
    let alive = true;
    // Fetch product details for each item
    Promise.all(
      parsed.map(async (item) => {
        try {
          const res = await request<any>(`products/${item.id}?storeId=${item.storeId}`);
          const prodData = unwrap<any>(res);
          if (prodData.storeId && Number(prodData.storeId) !== item.storeId) throw new Error('Магазин товара изменился');
          const p = product({ ...prodData, storeId: item.storeId });
          if (item.quantity % step(p)) throw new Error('Количество не соответствует шагу');
          if (p.supplements.some(s => s.isRequired && !item.supplements.some(selected => selected.supplementId === s.id))) throw new Error('Не выбраны обязательные добавки');
          for (const selected of item.supplements) {
            const definition = p.supplements.find(s => s.id === selected.supplementId);
            if (!definition || selected.valueIds.some(id => !definition.values.some(v => v.id === id))) throw new Error('Добавки недоступны');
          }
          return { ...item, product: p };
        } catch {
          return item;
        }
      }),
    )
      .then((loaded) => {
        if (!alive) return;
        const valid = loaded.filter((it) => it.product);
        if (valid.length !== parsed.length) {
          setError('Товары из этой ссылки больше недоступны или перемещены');
        } else {
          setItems(valid);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading shared cart:', err);
        setError('Не удалось загрузить товары из ссылки');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  async function handleAddAllToCart() {
    if (adding || !items.length) return;
    setAdding(true);

    try {
      for (let index = 0; index < items.length; index++) {
        const it = items[index];
        if (!it.product) continue;
        const key = 'shared-import:' + JSON.stringify(items.map(i => [i.id, i.quantity, i.storeId, i.supplements])) + ':' + index;
        const status = localStorage.getItem(key);
        if (status === 'done') continue;
        if (s.authenticated) {
          const pending = status ? JSON.parse(status) : { key: crypto.randomUUID(), createdAt: Date.now() };
          if (Date.now() - pending.createdAt > 23 * 60 * 60 * 1000) throw new Error('Срок безопасного повтора истёк. Проверьте корзину с магазином перед повторным импортом.');
          const retryKey = pending.key;
          localStorage.setItem(key, JSON.stringify(pending));
          await request('cart/items', 'POST', {
            productId: it.id, quantity: it.quantity, storeId: it.storeId, supplements: it.supplements,
          }, { idempotencyKey: retryKey });
        } else {
          addGuestCartItem(it.product, it.supplements, it.quantity);
        }
        localStorage.setItem(key, 'done');
      }
      await s.refresh();

      setAdded(true);
      s.notice('Товары добавлены в корзину');
      setTimeout(() => {
        router.push('/cart');
      }, 1000);
    } catch (err: any) {
      console.error('Error importing cart:', err);
      s.notice(err?.message || 'Не удалось перенести все товары в корзину');
      setAdding(false);
    }
  }

  const grandTotal = items.reduce((acc, it) => {
    return acc + (it.product ? itemAmount({ ...it, product: it.product }) : 0);
  }, 0);

  return (
    <div className="share-cart-page container">
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/cart">Корзина</Link>
        <span>/</span>
        <span>Общая корзина</span>
      </div>

      <div className="share-cart-card">
        <div className="share-cart-page-header">
          <div className="share-cart-badge">
            <ShoppingBasket size={24} />
          </div>
          <h1>Корзина, которой с вами поделились</h1>
          <p className="muted">
            Вы можете перенести все эти товары в свою корзину и оформить заказ
          </p>
        </div>

        {loading ? (
          <div className="share-cart-loading">
            <Loader2 className="spinner" size={36} />
            <p>Загрузка товаров из корзины…</p>
          </div>
        ) : error ? (
          <div className="share-cart-error">
            <p>{error}</p>
            <Link href="/catalog" className="primary">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <>
            <div className="share-cart-list">
              {items.map((it) => (
                <div key={`${it.storeId}:${it.id}:${JSON.stringify(it.supplements)}`} className="share-cart-item">
                  <div className="share-cart-item-photo">
                    <Photo
                      src={it.product?.preview || undefined}
                      alt={it.product?.title || 'Товар'}
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className="share-cart-item-details">
                    <Link
                      href={`/product/${it.product?.id}`}
                      className="share-cart-item-title"
                    >
                      {it.product?.title}
                    </Link>
                    <div className="share-cart-item-meta">
                      <span className="share-cart-item-qty">{it.product ? quantityLabel(it.product, it.quantity) : it.quantity}</span>
                      <span className="share-cart-item-price">
                        {money(it.product ? itemAmount({ ...it, product: it.product }) : 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="share-cart-summary">
              <div className="share-cart-total-row">
                <span>Предварительно:</span>
                <strong>{money(grandTotal)}</strong>
              </div>

              <div className="share-cart-footer-actions">
                <button
                  type="button"
                  className="primary share-cart-add-all-btn"
                  onClick={handleAddAllToCart}
                  disabled={adding || added}
                >
                  {added ? (
                    <>
                      <CheckCircle2 size={20} />
                      Товары добавлены! Переходим в корзину…
                    </>
                  ) : adding ? (
                    <>
                      <Loader2 className="spinner" size={20} />
                      Добавляем в вашу корзину…
                    </>
                  ) : (
                    <>
                      <ShoppingBasket size={20} />
                      Добавить всё в корзину
                    </>
                  )}
                </button>

                <Link href="/catalog" className="secondary share-cart-catalog-link">
                  Продолжить покупки в каталоге
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

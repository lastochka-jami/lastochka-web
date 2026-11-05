'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Plus,
  Minus,
  Maximize2,
  Share2,
  ArrowUpRight,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  Product,
  CartItem,
  money,
  quantityLabel,
  step,
  product,
  unwrap,
  formatAvailabilityText,
} from '@/lib/types';
import { request } from '@/lib/client';
import { useShop } from './shop-context';
import { Photo, Modal, ErrorMessage } from './ui';

export function ProductGrid({ products, imageSizes }: { products: Product[]; imageSizes?: string }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} imageSizes={imageSizes} />
      ))}
    </div>
  );
}

export function ProductCard({ p, imageSizes = '(max-width: 767px) calc((100vw - 60px) / 2), 220px' }: { p: Product; imageSizes?: string }) {
  const [quick, setQuick] = useState(false);

  const weightOrUnit =
    p.weight && p.weight > 0
      ? `${p.weight} гр`
      : quantityLabel(p, step(p));

  const availabilityText = formatAvailabilityText(p.availableFrom);

  return (
    <article className="product-card">
      <div className="product-photo">
        <Link href={'/product/' + p.id}>
          <Photo src={p.preview || undefined} alt={p.title} sizes={imageSizes} />
        </Link>
        {availabilityText && (
          <span className="availability-badge">
            <Clock size={11} strokeWidth={2.2} /> {availabilityText}
          </span>
        )}
        <Favorite p={p} />
        {p.priceOld && p.priceOld > p.price ? (
          <span className="discount">
            -{Math.round((1 - p.price / p.priceOld) * 100)}%
          </span>
        ) : null}
      </div>

      <div className="product-info">
        <Link className="product-title" href={'/product/' + p.id} title={p.title}>
          {p.title}
        </Link>
        <span className="product-weight">{weightOrUnit}</span>
      </div>

      <div className="product-bottom">
        {p.priceOld && p.priceOld > p.price ? (
          <span className="product-card-old-price">{money(p.priceOld)}</span>
        ) : null}
        <PillBuy p={p} onConfigure={() => setQuick(true)} />
      </div>

      {quick && <QuickProduct id={p.id} onClose={() => setQuick(false)} />}
    </article>
  );
}

export function PillBuy({
  p,
  onConfigure,
  supplements,
}: {
  p: Product;
  onConfigure?: () => void;
  supplements?: unknown[];
}) {
  const s = useShop();
  const [busy, setBusy] = useState(false);

  const items =
    s.cart?.storeGroups?.flatMap((g) => g.items) ||
    s.cart?.dateGroups?.flatMap((g) => g.items) ||
    [];
  const item = items.find(
    (i: CartItem) => i.product?.id === p.id && (!i.supplements || i.supplements.length === 0),
  );
  const configurable = p.isConfigurable || p.hasSupplements;

  async function run(f: () => Promise<void>) {
    setBusy(true);
    await f();
    setBusy(false);
  }

  if (p.stockQuantity <= 0) {
    return <span className="pill-btn disabled">Нет в наличии</span>;
  }

  if (item && !configurable) {
    return (
      <div className="pill-counter">
        <button
          disabled={busy}
          aria-label="Уменьшить количество"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void run(() => s.setQuantity(item.id, Math.max(0, item.quantity - step(p)), p));
          }}
        >
          <Minus size={15} />
        </button>
        <span className="pill-counter-val">{quantityLabel(p, item.quantity)}</span>
        <button
          disabled={busy || item.quantity + step(p) > p.stockQuantity}
          aria-label="Увеличить количество"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void run(() => s.setQuantity(item.id, item.quantity + step(p), p));
          }}
        >
          <Plus size={15} />
        </button>
      </div>
    );
  }

  return (
    <button
      className="pill-buy-btn"
      disabled={busy}
      aria-label={`Добавить ${p.title} в корзину`}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (configurable && onConfigure) {
          onConfigure();
        } else {
          void run(() => s.add(p, supplements));
        }
      }}
    >
      <span className="pill-price">{money(p.price)}</span>
      <span className="pill-icon">
        <Plus size={16} />
      </span>
    </button>
  );
}

export function ProductCarousel({
  products,
  title,
  href,
  subtitle,
}: {
  products: Product[];
  title?: string;
  href?: string;
  subtitle?: string;
}) {
  if (!products.length) return null;
  // Only limit previews when the complete collection has a destination.
  const preview = href ? products.slice(0, 8) : products;
  return (
    <div className="product-carousel-wrapper">
      {(title || href) && (
        <div className="section-heading">
          <div>
            {subtitle && <p className="eyebrow">{subtitle}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {href && <Link href={href} className="carousel-see-all">Смотреть всё <ArrowRight size={18} /></Link>}
        </div>
      )}
      <ProductGrid products={preview} />
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="product-grid skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="product-card skeleton-card" key={i}>
          <div className="product-photo skeleton" />
          <div className="skeleton line" style={{ width: '85%', height: 16, marginTop: 10 }} />
          <div className="skeleton line" style={{ width: '45%', height: 12, marginTop: 6 }} />
          <div className="skeleton pill" style={{ height: 38, marginTop: 12, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

export function Favorite({ p }: { p: Product }) {
  const s = useShop();
  const [liked, setLiked] = useState(p.isFavorite);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(p.isFavorite);
  }, [p.isFavorite]);

  return (
    <button
      className={`favorite icon-button ${liked ? 'liked' : ''}`}
      aria-label={liked ? 'Удалить из избранного' : 'Добавить в избранное'}
      aria-pressed={liked}
      disabled={busy}
      type="button"
      onClick={async () => {
        if (!s.authenticated) {
          s.login();
          return;
        }
        setBusy(true);
        await s.run(async () => {
          const d = await request<{ isFavorite?: boolean }>('favorites/toggle', 'POST', {
            productId: p.id,
          });
          setLiked(typeof d.isFavorite === 'boolean' ? d.isFavorite : !liked);
        });
        setBusy(false);
      }}
    >
      <Heart size={19} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Buy({
  p,
  onConfigure,
  supplements,
}: {
  p: Product;
  onConfigure?: () => void;
  supplements?: unknown[];
}) {
  const s = useShop();
  const [busy, setBusy] = useState(false);

  const items =
    s.cart?.storeGroups?.flatMap((g) => g.items) ||
    s.cart?.dateGroups?.flatMap((g) => g.items) ||
    [];
  const item = items.find(
    (i: CartItem) => i.product?.id === p.id && (!i.supplements || i.supplements.length === 0),
  );
  const configurable = p.isConfigurable || p.hasSupplements;

  async function run(f: () => Promise<void>) {
    setBusy(true);
    await f();
    setBusy(false);
  }

  if (p.stockQuantity <= 0) {
    return <span className="unavailable">Нет в наличии</span>;
  }

  if (item && !configurable) {
    return (
      <div className="counter">
        <button
          disabled={busy}
          aria-label="Уменьшить количество"
          type="button"
          onClick={() => run(() => s.setQuantity(item.id, Math.max(0, item.quantity - step(p)), p))}
        >
          <Minus size={16} />
        </button>
        <span>{quantityLabel(p, item.quantity)}</span>
        <button
          disabled={busy || item.quantity + step(p) > p.stockQuantity}
          aria-label="Увеличить количество"
          type="button"
          onClick={() => run(() => s.setQuantity(item.id, item.quantity + step(p), p))}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      className="add-button"
      disabled={busy}
      aria-label={'Добавить ' + p.title + ' в корзину'}
      type="button"
      onClick={() => {
        if (configurable && onConfigure) {
          onConfigure();
        } else {
          void run(() => s.add(p, supplements));
        }
      }}
    >
      <Plus size={19} />
      <span>В корзину</span>
    </button>
  );
}

export function CartQuantity({
  itemId,
  p,
  quantity,
}: {
  itemId: number;
  p: Product;
  quantity: number;
}) {
  const s = useShop();
  const [busy, setBusy] = useState(false);

  async function change(next: number) {
    setBusy(true);
    await s.setQuantity(itemId, next, p);
    setBusy(false);
  }

  return (
    <div className="counter">
      <button
        disabled={busy}
        aria-label={`Уменьшить количество ${p.title}`}
        type="button"
        onClick={() => void change(Math.max(0, quantity - step(p)))}
      >
        <Minus size={16} />
      </button>
      <span>{quantityLabel(p, quantity)}</span>
      <button
        disabled={busy || quantity + step(p) > p.stockQuantity}
        aria-label={`Увеличить количество ${p.title}`}
        type="button"
        onClick={() => void change(quantity + step(p))}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function QuickProduct({ id, onClose }: { id: number; onClose: () => void }) {
  const shop = useShop();
  const [attempt, setAttempt] = useState(0);
  const [p, setP] = useState<Product>();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setP(undefined); setError('');
    request('products/' + id + '?storeId=' + shop.storeId)
      .then((d) => {
        if (alive) setP(product(unwrap(d)));
      })
      .catch((e) => { if (alive) setError(e.message); });
    return () => {
      alive = false;
    };
  }, [id, shop.storeId, attempt]);

  return (
    <Modal title="О товаре" onClose={onClose} wide>
      {error ? (
        <ErrorMessage message={error} retry={() => setAttempt(n => n + 1)} />
      ) : p ? (
        <>
          <ProductDetail p={p} />
          <Link className="text-button" href={'/product/' + id} onClick={onClose}>
            Открыть страницу товара <ArrowUpRight size={16} />
          </Link>
        </>
      ) : (
        <p>Загружаем товар…</p>
      )}
    </Modal>
  );
}

export function ProductDetail({ p: initial, stickyBuy = false }: { p: Product; stickyBuy?: boolean }) {
  const [p, setP] = useState(initial);
  const variantRequest = useRef(0);
  const [imageIndex, setImage] = useState(0);
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const s = useShop();

  const availabilityText = formatAvailabilityText(p.availableFrom);

  useEffect(() => {
    ++variantRequest.current;
    setP(initial);
    setImage(0);
    setSelected({});
  }, [initial]);

  const missing = p.supplements.some((sup) => sup.isRequired && !selected[sup.id]?.length);
  const supplements = p.supplements
    .filter((sup) => selected[sup.id]?.length)
    .map((sup) => ({ supplementId: sup.id, valueIds: selected[sup.id] }));

  return (
    <div className={`product-detail ${stickyBuy ? 'has-mobile-buy-bar' : ''}`}>
      <div className="gallery">
        <Photo
          src={p.images?.[imageIndex]?.path}
          alt={p.title}
          sizes="(max-width: 767px) calc(100vw - 28px), (max-width: 1023px) calc((100vw - 72px) * 0.45), (max-width: 1399px) calc((100vw - 138px) * 0.55), 699px"
          eager={stickyBuy && imageIndex === 0}
        />
        {p.images?.length > 1 && (
          <div className="thumbnails">
            {p.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImage(i)}
                aria-label={`Фото ${i + 1}`}
                aria-pressed={i === imageIndex}
                type="button"
              >
                <Photo src={im.thumbPath || im.path} alt="" width={72} height={72} sizes="72px" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="product-information">
        <div className="detail-actions">
          <Favorite p={p} />
          <button
            className="icon-button"
            aria-label="Поделиться товаром"
            type="button"
            onClick={() =>
              s.run(async () => {
                const url = location.origin + '/shop/product/' + p.id;
                if (navigator.share) {
                  await navigator.share({ title: p.title, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  s.notice('Ссылка скопирована');
                }
              })
            }
          >
            <Share2 size={19} />
          </button>
        </div>
        {p.category && (
          <Link className="eyebrow" href={'/category/' + (p.category.slug || p.category.id)}>
            {p.category.name}
          </Link>
        )}
        <h1>{p.title}</h1>
        {availabilityText && (
          <div className="product-detail-availability">
            <span className="availability-badge-inline">
              <Clock size={13} strokeWidth={2.2} /> {availabilityText}
            </span>
          </div>
        )}
        <p className="muted">
          {p.weight && p.weight > 0 ? `${p.weight} г · ` : ''}
          Цена за {quantityLabel(p, step(p))}
          {p.pickupOnly ? ' · Только самовывоз' : ''}
        </p>
        <div className="detail-price">
          {money(p.price)}{' '}
          {p.priceOld && p.priceOld > p.price ? <del>{money(p.priceOld)}</del> : null}
        </div>

        {p.isConfigurable && p.variants?.length ? (
          <label>
            Вариант
            <select
              value={p.id}
              onChange={(e) =>
                s.run(async () => {
                  const version = ++variantRequest.current;
                  const d = product(unwrap(await request('products/' + e.target.value + '?storeId=' + (p.storeId || s.storeId))));
                  if (variantRequest.current !== version) return;
                  setP(d);
                  setImage(0);
                  setSelected({});
                })
              }
            >
              <option value={p.id}>Выберите вариант</option>
              {p.variants.map((v) => (
                <option key={v.id} value={v.id} disabled={v.stockQuantity <= 0}>
                  {v.title} · {money(v.price)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {p.supplements.map((sup) => (
          <fieldset key={sup.id}>
            <legend>
              {sup.title}
              {sup.isRequired ? ' *' : ''}
            </legend>
            {sup.values.map((v) => (
              <label className="check" key={v.id}>
                <input
                  type="checkbox"
                  checked={selected[sup.id]?.includes(v.id) || false}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      [sup.id]: e.target.checked
                        ? [...(selected[sup.id] || []), v.id]
                        : (selected[sup.id] || []).filter((id) => id !== v.id),
                    })
                  }
                />
                {v.title || v.name}
                {typeof v.price === 'number' && v.price > 0 ? ` + ${money(v.price)}` : ''}
              </label>
            ))}
          </fieldset>
        ))}

        <div className="detail-buy">
          {missing ? (
            <p className="muted">Выберите обязательные добавки</p>
          ) : (
            <Buy p={p} supplements={supplements} />
          )}
          <span className="muted">{p.stockQuantity > 0 ? 'В наличии' : 'Нет в наличии'}</span>
        </div>

        {p.description && (
          <section>
            <h3>О продукте</h3>
            <p>{p.description}</p>
          </section>
        )}

        {p.composition && (
          <section>
            <h3>Состав</h3>
            <p>{p.composition}</p>
          </section>
        )}

        {[p.proteins,p.fats, p.carbohydrates, p.calories].some(
          (v) => typeof v === 'number' && v > 0,
        ) && (
          <section>
            <h3>На 100 г продукта</h3>
            <div className="nutrition">
              {[
                ['Белки', p.proteins],
                ['Жиры', p.fats],
                ['Углеводы', p.carbohydrates],
                ['Ккал', p.calories],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <strong>{v ?? '—'}</strong>
                  <small>{k}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {p.additionalInfo && <p>{p.additionalInfo}</p>}
      </div>
      {stickyBuy && !missing && (
        <div className="mobile-product-buy-bar" aria-label="Быстрая покупка">
          <div>
            <small>{p.weight && p.weight > 0 ? `${p.weight} г` : quantityLabel(p, step(p))}</small>
            <strong>{money(p.price)}</strong>
          </div>
          <Buy p={p} supplements={supplements} />
        </div>
      )}
    </div>
  );
}

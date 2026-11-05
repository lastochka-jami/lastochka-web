'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useId, useRef } from 'react';
import {
  MapPin,
  Search,
  Heart,
  UserRound,
  ShoppingBasket,
  House,
  LayoutGrid,
  Menu,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Trash2,
  ScanLine,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const BarcodeScannerModal = dynamic(() => import('./barcode-scanner-modal').then(m => m.BarcodeScannerModal), { ssr: false });
import {
  LOCATION_CHANGED_EVENT,
  LOCATION_MODE_STORAGE_KEY,
  LOCATION_OPEN_EVENT,
  LocationSheet,
  type LocationMode,
  type LocationSelection,
} from './location-sheet';
import { useShop } from './shop-context';
import { request } from '@/lib/client';
import { list, money, Store, CartItem, product, type Address, itemAmount, quantityLabel, cartItems, cartTotal } from '@/lib/types';
import { Modal, Photo } from './ui';
import { HomeBrandLink } from './home-brand-link';
import { readLocation } from '@/lib/fulfillment';
import { NavigationScroll } from './navigation-scroll';

function getInnerScreenTitle(path: string): string | null {
  if (path === '/profile') return 'Профиль';
  if (path.startsWith('/profile/settings')) return 'Настройки';
  if (path === '/favorites') return 'Избранное';
  if (path.startsWith('/orders')) return 'Мои заказы';
  if (path.startsWith('/addresses')) return 'Адреса доставки';
  if (path.startsWith('/cards')) return 'Способы оплаты';
  if (path.startsWith('/bonuses')) return 'Карта и бонусы';
  if (path.startsWith('/notifications')) return 'Уведомления';
  if (path.startsWith('/promotions')) return 'Акции';
  if (path.startsWith('/reviews')) return 'Отзывы';
  if (path === '/faq') return 'Помощь';
  if (path === '/info') return 'Информация';
  return null;
}

export function Header({ store }: { store: Store | null }) {
  const s = useShop();
  const router = useRouter();
  const path = usePathname();

  const [chooseStoreOpen, setChooseStoreOpen] = useState(false);
  const [locationTab, setLocationTab] = useState<LocationMode>('delivery');
  const [locationSelection, setLocationSelection] = useState<LocationSelection>({
    mode: 'delivery',
  });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const cartPreviewTimeout = useRef<NodeJS.Timeout | null>(null);

  const items = cartItems(s.cart);
  const total = cartTotal(s.cart, s.locationMode === 'pickup');

  const innerTitle = getInnerScreenTitle(path);

  useEffect(() => {
    const saved = readLocation();
    setLocationTab(saved.mode);
    setLocationSelection(saved);

    const openLocation = (event: Event) => {
      const requestedTab = (event as CustomEvent<LocationMode>).detail;
      if (requestedTab === 'delivery' || requestedTab === 'pickup') {
        setLocationTab(requestedTab);
      }
      setChooseStoreOpen(true);
    };
    const updateLocation = (event: Event) => {
      const selection = (event as CustomEvent<LocationSelection>).detail;
      if (selection?.mode) {
        setLocationTab(selection.mode);
        setLocationSelection(selection);
      }
    };

    window.addEventListener(LOCATION_OPEN_EVENT, openLocation);
    window.addEventListener(LOCATION_CHANGED_EVENT, updateLocation);
    return () => {
      window.removeEventListener(LOCATION_OPEN_EVENT, openLocation);
      window.removeEventListener(LOCATION_CHANGED_EVENT, updateLocation);
    };
  }, []);

  useEffect(() => {
    if (!s.ready || !s.authenticated) return;

    let active = true;
    void request<unknown>('addresses')
      .then(list<Address>)
      .then((addresses) => {
        const address = addresses.find((item) => item.isActive);
        if (!active || !address) return;
        const label = [address.city, address.street, address.houseNumber && `д. ${address.houseNumber}`]
          .filter(Boolean)
          .join(', ');
        setLocationSelection((current) =>
          current.mode === 'delivery' ? { mode: 'delivery', label } : current,
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [s.authenticated, s.ready]);

  const pickupLabel =
    !store || store.name.trim().toLowerCase() === 'default'
      ? 'Ласточка Джами'
      : store.address || store.name;
  const locationLabel =
    locationSelection.mode === 'pickup'
      ? locationSelection.label || pickupLabel
      : locationSelection.label || 'Указать адрес';

  const nav = [
    { href: '/', title: 'Главная', Icon: House },
    { href: '/catalog', title: 'Каталог', Icon: Menu },
    { href: '/favorites', title: 'Избранное', Icon: Heart },
    { href: '/profile', title: 'Профиль', Icon: UserRound },
  ];

  useEffect(() => () => {
    if (cartPreviewTimeout.current) clearTimeout(cartPreviewTimeout.current);
  }, []);

  useEffect(() => { setCartPreviewOpen(false); }, [path]);

  const handleCartMouseEnter = () => {
    if (cartPreviewTimeout.current) clearTimeout(cartPreviewTimeout.current);
    setCartPreviewOpen(true);
  };

  const handleCartMouseLeave = () => {
    cartPreviewTimeout.current = setTimeout(() => {
      setCartPreviewOpen(false);
    }, 250);
  };

  return (
    <>
      <NavigationScroll />
      <div className="topline">
        <div className="container">
          <span>Продукты, выпечка и готовые блюда с доставкой от «Ласточки»</span>
          <Link href="/faq">Помощь и ответы на вопросы ↗</Link>
        </div>
      </div>

      <header
        className={`header ${innerTitle ? 'header-has-app-bar' : ''} ${
          path === '/cart' ? 'header-on-cart' : path === '/profile' ? 'header-on-profile' : ''
        } ${path === '/' ? 'header-home-peach' : ''}`}
      >
        {/* Contextual Mobile App Bar on inner screens */}
        {innerTitle && (
          <div className="container mobile-app-bar">
            <button
              type="button"
              className="mobile-app-bar-back"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              aria-label="Назад"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="mobile-app-bar-title">{innerTitle}</div>
            <div className="mobile-app-bar-action" aria-hidden="true" />
          </div>
        )}

        <div className="container header-row">
          <HomeBrandLink className="brand" imageSize={46}>
            <span>
              Ласточка<small>Джами</small>
            </span>
          </HomeBrandLink>

          <Link className="catalog-button" href="/catalog">
            <Menu size={20} /> Каталог
          </Link>

          <SearchBox onOpenScanner={() => setScannerOpen(true)} />

          <button
            className="location"
            onClick={() => setChooseStoreOpen(true)}
            type="button"
            aria-label="Выбор адреса и магазина доставки"
          >
            <MapPin size={20} className="location-pin-icon" />
            <span>
              <small className="location-subtitle">
                {locationSelection.mode === 'pickup' ? 'Самовывоз' : 'Доставка'}
              </small>
              <strong className="location-name">{locationLabel}</strong>
            </span>
            <ChevronDown size={14} className="location-chevron" />
          </button>

          <Link className="header-action" href="/profile">
            <UserRound />
            <span>{s.authenticated ? 'Кабинет' : 'Войти'}</span>
          </Link>

          {/* Cart button with desktop popover */}
          <div
            className="cart-button-container"
            onMouseEnter={handleCartMouseEnter}
            onMouseLeave={handleCartMouseLeave}
            onFocus={handleCartMouseEnter}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) handleCartMouseLeave();
            }}
          >
            <Link className="cart-button" href="/cart" aria-label={`Открыть корзину${items.length ? `, ${items.length} поз., ${money(total)}` : ", пуста"}`}>
              <ShoppingBasket />
              <span>
                {typeof total === 'number' && total > 0 ? money(total) : 'Корзина'}
                {items.length > 0 && <small>{items.length}</small>}
              </span>
            </Link>

            {/* Desktop Cart Preview Popover */}
            {cartPreviewOpen && (
              <div className="cart-preview-popover">
                <div className="cart-preview-header">
                  <strong>Корзина</strong>
                  <span className="muted">{items.length} поз.</span>
                </div>

                {items.length > 0 ? (
                  <>
                    <div className="cart-preview-items">
                      {items.slice(0, 5).map((it) => {
                        const normalized = product(it.product);
                        return (
                          <div key={it.id} className="cart-preview-item">
                            <Photo
                              src={normalized.preview || undefined}
                              alt={normalized.title}
                              width={40}
                              height={40}
                              className="cart-preview-photo"
                            />
                            <div className="cart-preview-info">
                              <span className="cart-preview-title">{normalized.title}</span>
                              <small className="muted">
                                {quantityLabel(normalized, it.quantity)} · {money(itemAmount(it))}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                      {items.length > 5 && (
                        <p className="cart-preview-more muted">И ещё {items.length - 5} товаров…</p>
                      )}
                    </div>

                    <div className="cart-preview-footer">
                      <div className="cart-preview-total">
                        <span>Итого:</span>
                        <strong>{typeof total === 'number' ? money(total) : '—'}</strong>
                      </div>
                      <Link
                        href="/cart"
                        className="primary cart-preview-checkout-btn"
                        onClick={() => setCartPreviewOpen(false)}
                      >
                        Открыть корзину <ArrowRight size={16} />
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="cart-preview-empty">
                    <p className="muted">В вашей корзине пока пусто</p>
                    <Link
                      href="/catalog"
                      className="secondary cart-preview-catalog-btn"
                      onClick={() => setCartPreviewOpen(false)}
                    >
                      Перейти в каталог
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Header Bar */}
        <div className="container mobile-address">
          <button
            type="button"
            className="mobile-address-capsule"
            aria-label="Указать адрес доставки"
            onClick={() => {
              setLocationTab('delivery');
              setChooseStoreOpen(true);
            }}
          >
            <House size={17} className="capsule-home-icon" />
            <span className="capsule-address-text">{locationLabel}</span>
            <ChevronRight size={15} className="capsule-chevron-icon" />
          </button>
          <Link href="/notifications" className="mobile-bell-btn" aria-label="Уведомления">
            <Bell size={20} />
          </Link>
        </div>
      </header>

      {/* Mobile Bottom Navigation: Exactly 4 items */}
      <nav className="bottom-nav" aria-label="Основная навигация">
        {nav.map(({ href, title, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}
            className={href === '/' ? (path === '/' ? 'active' : '') : path.startsWith(href) ? 'active' : ''}
          >
            <Icon size={21} />
            <span>{title}</span>
          </Link>
        ))}
      </nav>

      {/* Floating Cart Pill on Mobile (only if cart has items and not on /cart page) */}
      {items.length > 0 && path !== '/cart' && !path.startsWith('/product/') && (
        <div className={`float-actions ${path.startsWith("/product/") || path === "/cart" ? "hidden-on-product" : ""}`} aria-label="Быстрые действия">
          <Link className="float-cart-btn" href="/cart" aria-label="Открыть корзину">
            <ShoppingBasket size={19} />
            <span>{typeof total === 'number' && total > 0 ? money(total) : 'Корзина'}</span>
          </Link>
        </div>
      )}

      <LocationSheet
        isOpen={chooseStoreOpen}
        onClose={() => setChooseStoreOpen(false)}
        currentStore={store}
        initialTab={locationTab}
      />

      {scannerOpen && <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />}
    </>
  );
}

export function SearchBox({ onOpenScanner }: { onOpenScanner?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placeholder, setPlaceholder] = useState('Искать товары...');

  useEffect(() => {
    if (pathname === '/search' && !q) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  useEffect(() => {
    const updatePlaceholder = () => {
      setPlaceholder(window.innerWidth < 768 ? 'Искать товары...' : 'Поиск продуктов и блюд...');
    };
    updatePlaceholder();
    window.addEventListener('resize', updatePlaceholder);
    return () => window.removeEventListener('resize', updatePlaceholder);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      request<any>('search/suggestions?query=' + encodeURIComponent(q))
        .then((d) => {
          if (active) {
            setSuggestions(list(d).slice(0, 5));
            setActiveIndex(-1);
          }
        })
        .catch(() => setSuggestions([]));
    }, 300);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <form
      className="search-box"
      action="/search"
      onSubmit={(e) => {
        e.preventDefault();
        setSuggestions([]);
        router.push('/search?query=' + encodeURIComponent(q));
      }}
    >
      <Search size={20} className="search-icon" />
      <input
        ref={inputRef}
        name="query"
        aria-label="Поиск товаров"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestions([]);
            setActiveIndex(-1);
          } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            const value = suggestions[activeIndex];
            const text = typeof value === 'string' ? value : value.title || value.text || value.query;
            if (text) {
              setQ(text);
              setSuggestions([]);
              router.push('/search?query=' + encodeURIComponent(text));
            }
          }
        }}
        minLength={2}
      />
      {onOpenScanner && (
        <button
          type="button"
          className="search-barcode-btn"
          onClick={onOpenScanner}
          aria-label="Сканировать штрихкод"
          title="Сканировать штрихкод"
        >
          <ScanLine size={18} />
        </button>
      )}
      <button className="search-submit-btn" aria-label="Найти" type="submit">
        <ArrowRight size={17} />
      </button>
      {suggestions.length > 0 && (
        <div className="suggestions" id={listboxId} role="listbox" aria-label="Подсказки поиска">
          {suggestions.map((v, i) => {
            const text = typeof v === 'string' ? v : v.title || v.text || v.query;
            return text ? (
              <button
                key={i}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? 'active' : ''}
                type="button"
                onClick={() => {
                  setQ(text);
                  setSuggestions([]);
                  router.push('/search?query=' + encodeURIComponent(text));
                }}
              >
                {text}
              </button>
            ) : null;
          })}
        </div>
      )}
    </form>
  );
}

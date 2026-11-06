'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { request, browserSession, requestPhoneCode, confirmPhoneCode } from '@/lib/client';
import { Product, Cart, unwrap, Store, list, step } from '@/lib/types';
import {
  getGuestCart,
  addGuestCartItem,
  setGuestCartQuantity,
  mergeGuestCartToServer,
  syncGuestCartStores,
} from '@/lib/guest-cart';
import { Modal, ErrorMessage } from './ui';
import { LOCATION_CHANGED_EVENT, readLocation, type LocationMode } from '@/lib/fulfillment';

export interface ShopContextValue {
  authenticated: boolean;
  ready: boolean;
  cart: Cart | null;
  cartError: string;
  refresh: () => Promise<void>;
  login: () => void;
  run: <T>(f: () => Promise<T>) => Promise<T | undefined>;
  notice: (message: string) => void;
  add: (p: Product, supplements?: unknown[]) => Promise<void>;
  setQuantity: (id: number, n: number, p?: Product) => Promise<void>;
  logout: () => Promise<void>;
  checkoutEnabled: boolean;
  publicOrigin: string;
  storeId: number;
  locationMode: LocationMode;
  reportError: (message: string) => void;
}

const Context = createContext<ShopContextValue>(null!);

export const useShop = () => useContext(Context);

export function ShopProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuth] = useState(false);
  const [ready, setReady] = useState(false);
  const [cartError, setCartError] = useState('');
  const [cart, setCart] = useState<Cart | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const notice = (text: string) => setMessage({ text, error: false });
  const reportError = (text: string) => setMessage({ text, error: true });
  const [locationMode, setLocationMode] = useState<LocationMode>('delivery');
  const stores = useRef<Store[]>([]);
  const refreshVersion = useRef(0);
  const [checkoutEnabled, setCheckout] = useState(false);
  const [publicOrigin, setPublicOrigin] = useState('');
  const [storeId, setStoreId] = useState(2);

  const knownSession = useRef<Awaited<ReturnType<typeof browserSession>> | null>(null);
  const refresh = useCallback(async (reloadSession = true) => {
    const version = ++refreshVersion.current;
    const selection = readLocation();
    setLocationMode(selection.mode);
    setCartError('');
    try {
      const sessionData = !reloadSession && knownSession.current ? knownSession.current : await browserSession();
      if (version !== refreshVersion.current) return;
      knownSession.current = sessionData;
      setAuth(sessionData.authenticated);
      setStoreId(sessionData.storeId);
      setCheckout(sessionData.checkoutEnabled);
      setPublicOrigin(sessionData.publicOrigin);
      if (sessionData.authenticated) {
        const query = new URLSearchParams({ shippingMethod: selection.mode === 'pickup' ? 'pickup' : 'courier' });
        if (selection.mode === 'delivery' && selection.addressId) query.set('addressId', String(selection.addressId));
        const serverCart = unwrap<Cart>(await request('cart?' + query));
        if (version === refreshVersion.current) setCart(serverCart);
      } else {
        // Store capabilities and pickup addresses come from the same API as the location picker.
        stores.current = list<Store>(await request('stores?perPage=100'));
        if (version === refreshVersion.current) setCart(syncGuestCartStores(stores.current));
      }
    } catch (error: any) {
      if (version !== refreshVersion.current) return;
      const text = error instanceof Error ? error.message : 'Не удалось загрузить корзину';
      setCartError(text);
      reportError(text);
      if (error?.status === 401) {
        setAuth(false);
        setCart(getGuestCart());
        setAuthOpen(true);
      } else {
        setCart(current => current || getGuestCart());
      }
    } finally {
      if (version === refreshVersion.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    const expired = () => { setAuth(false); setCart(getGuestCart()); setAuthOpen(true); };
    window.addEventListener('lastochka:unauthorized', expired);
    return () => window.removeEventListener('lastochka:unauthorized', expired);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!message || message.error) return;
    const timer = setTimeout(() => setMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const changed = () => { void refresh(); };
    window.addEventListener(LOCATION_CHANGED_EVENT, changed);
    return () => window.removeEventListener(LOCATION_CHANGED_EVENT, changed);
  }, [refresh]);

  async function run<T>(f: () => Promise<T>): Promise<T | undefined> {
    try {
      return await f();
    } catch (err: any) {
      if (err?.status === 401) {
        setAuth(false);
        setCart(getGuestCart());
        setAuthOpen(true);
      } else {
        reportError(err instanceof Error ? err.message : 'Произошла ошибка');
      }
      return undefined;
    }
  }

  async function add(p: Product, supplements?: unknown[]) {
    if (!authenticated) {
      // Guest cart addition
      try {
        const productStoreId = p.storeId || storeId;
        if (!stores.current.some(store => store.id === productStoreId)) stores.current = list<Store>(await request('stores?perPage=100'));
        const store = stores.current.find(store => store.id === productStoreId);
        if (!store || store.isActive === false) throw new Error('Магазин товара сейчас недоступен');
        const updated = addGuestCartItem({ ...p, storeId: productStoreId }, supplements, step(p), store);
        setCart(updated);
        notice('Товар добавлен в корзину');
      } catch (e) { reportError((e as Error).message); }
      return;
    }

    await run(async () => {
      await request('cart/items', 'POST', {
          productId: p.id,
          quantity: step(p),
          storeId: p.storeId || storeId,
          supplements,
        });
      await refresh(false);
      notice('Товар добавлен в корзину');
    });
  }

  async function setQuantity(id: number, n: number, p?: Product) {
    if (!authenticated) {
      // Guest cart quantity update
      try { setCart(setGuestCartQuantity(id, n, p)); } catch (e) { reportError((e as Error).message); }
      return;
    }

    await run(async () => {
      await request(`cart/items/${id}`, n > 0 ? 'PUT' : 'DELETE', n > 0 ? { quantity: n } : undefined);
      await refresh(false);
    });
  }

  async function logout() {
    await run(async () => {
      await request('auth/logout', 'POST');
      setAuth(false);
      setCart(getGuestCart());
      await refresh();
      router.refresh();
    });
  }

  const handleLoginSuccess = async () => {
    setAuthOpen(false);
    setAuth(true);
    ++refreshVersion.current;
    try {
      const result = await mergeGuestCartToServer();
      if (result.remaining) reportError(`Перенесено позиций: ${result.accepted}. Не перенесено: ${result.remaining}. Они сохранены на устройстве; повторите перенос в корзине.`);
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Не удалось перенести корзину. Товары сохранены на устройстве.');
    } finally {
      await refresh();
      router.refresh();
    }
  };

  return (
    <Context.Provider
      value={{
        authenticated,
        ready,
        cart,
        cartError,
        refresh,
        login: () => setAuthOpen(true),
        run,
        notice,
        reportError,
        locationMode,
        add,
        setQuantity,
        logout,
        checkoutEnabled,
        publicOrigin,
        storeId,
      }}
    >
      {children}
      {message && (
        <div className={`toast${message.error ? ' toast-error' : ''}`} role={message.error ? 'alert' : 'status'}>
          <span>{message.text}</span>
          {message.error && <button type="button" className="text-button" aria-label="Закрыть сообщение" onClick={() => setMessage(null)}>Закрыть</button>}
        </div>
      )}
      {authOpen && (
        <Login onClose={() => setAuthOpen(false)} onSuccess={handleLoginSuccess} />
      )}
    </Context.Provider>
  );
}

function Login({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => Promise<void> }) {
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [length, setLength] = useState(6);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resend, setResend] = useState(0);

  useEffect(() => {
    if (resend <= 0) return;
    const t = setTimeout(() => setResend((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [resend]);

  async function sendCode() {
    setBusy(true);
    setError('');
    try {
      const result = await requestPhoneCode(phone);
      setLength(result.codeLength);
      setPhone(result.phone);
      setCode('');
      setSent(true);
      setResend(60);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (sent) {
        await confirmPhoneCode(phone, code, length);
        await onSuccess();
      } else {
        await sendCode();
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={sent ? 'Введите код из SMS' : 'Рады вас видеть'} onClose={onClose}>
      <p className="muted">
        {sent
          ? `Отправили код на ${phone}`
          : 'Войдите, чтобы сохранять любимые товары, копить бонусы и оформлять заказы.'}
      </p>
      <form className="stack" onSubmit={submit}>
        {!sent ? (
          <label>
            Номер телефона
            <input
              autoFocus
              data-modal-initial-focus
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              placeholder="+7 900 000-00-00"
            />
          </label>
        ) : (
          <label>
            Код подтверждения
            <input
              autoFocus
              data-modal-initial-focus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`[0-9]{${length}}`}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              required
            />
          </label>
        )}
        {error && <ErrorMessage message={error} />}
        <button className="primary" disabled={busy} type="submit">
          {busy ? 'Подождите…' : sent ? 'Войти' : 'Получить код'}
        </button>
        {sent && (
          <>
            <button type="button" className="text-button" disabled={busy || resend > 0} onClick={() => void sendCode()}>
              {resend > 0 ? `Повторить через ${resend} с` : 'Отправить код снова'}
            </button>
            <button type="button" className="text-button" disabled={busy} onClick={() => { setSent(false); setCode(''); setError(''); }}>
              Изменить номер
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}

export function AuthGate({
  children,
  title = 'Войдите в аккаунт',
}: {
  children: ReactNode;
  title?: string;
}) {
  const s = useShop();

  if (!s.ready) {
    return <p className="muted">Загружаем…</p>;
  }

  if (s.authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="auth-gate">
      <img src="/shop/images/swallow-transparent-v2.webp" alt="" width={64} height={64} />
      <h1>{title}</h1>
      <p>Ваши покупки, адреса и бонусы будут доступны после входа.</p>
      <button className="primary" onClick={s.login} type="button">
        Войти по телефону
      </button>
    </div>
  );
}

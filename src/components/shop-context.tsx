'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { request, browserSession } from '@/lib/client';
import { Product, Cart, unwrap } from '@/lib/types';
import {
  getGuestCart,
  addGuestCartItem,
  setGuestCartQuantity,
  mergeGuestCartToServer,
} from '@/lib/guest-cart';
import { Modal, ErrorMessage } from './ui';

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
  const [message, setMessage] = useState('');
  const [checkoutEnabled, setCheckout] = useState(false);
  const [publicOrigin, setPublicOrigin] = useState('');
  const [storeId, setStoreId] = useState(2);

  const refresh = useCallback(async () => {
    setCartError('');
    try {
      const sessionData = await browserSession();
      setAuth(sessionData.authenticated);
      setStoreId(sessionData.storeId);
      setCheckout(sessionData.checkoutEnabled);
      setPublicOrigin(sessionData.publicOrigin);
      setReady(true);

      if (sessionData.authenticated) {
        try {
          const serverCart = unwrap<Cart>(await request('cart'));
          setCart(serverCart);
        } catch (err: any) {
          setCartError(err.message || 'Не удалось загрузить корзину');
          if (err?.status === 401) { setAuth(false); setCart(getGuestCart()); setAuthOpen(true); }
          setMessage((err as Error).message);
        }
      } else {
        // Load guest cart from local storage
        setCart(getGuestCart());
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось загрузить сессию");
      setReady(true);
      setCart(getGuestCart());
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
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6500);
    return () => clearTimeout(timer);
  }, [message]);

  async function run<T>(f: () => Promise<T>): Promise<T | undefined> {
    try {
      return await f();
    } catch (err: any) {
      if (err?.status === 401) {
        setAuth(false);
        setCart(getGuestCart());
        setAuthOpen(true);
      } else {
        setMessage(err instanceof Error ? err.message : 'Произошла ошибка');
      }
      return undefined;
    }
  }

  async function add(p: Product, supplements?: unknown[]) {
    if (!authenticated) {
      // Guest cart addition
      try {
        const updated = addGuestCartItem({ ...p, storeId: p.storeId || storeId }, supplements);
        setCart(updated);
        setMessage('Товар добавлен в корзину');
      } catch (e) { setMessage((e as Error).message); }
      return;
    }

    await run(async () => {
      const updated = unwrap<Cart>(
        await request('cart/items', 'POST', {
          productId: p.id,
          quantity: Math.max(1, Number(p.quantityStep) || 1),
          storeId: p.storeId,
          supplements,
        }),
      );
      setCart(updated);
      setMessage('Товар добавлен в корзину');
    });
  }

  async function setQuantity(id: number, n: number, p?: Product) {
    if (!authenticated) {
      // Guest cart quantity update
      try { setCart(setGuestCartQuantity(id, n, p)); } catch (e) { setMessage((e as Error).message); }
      return;
    }

    await run(async () => {
      const response = unwrap<any>(
        await request(`cart/items/${id}`, n > 0 ? 'PUT' : 'DELETE', n > 0 ? { quantity: n } : undefined),
      );
      if (response?.storeGroups || response?.dateGroups) {
        setCart(response);
      } else {
        setCart(unwrap<Cart>(await request('cart')));
      }
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
    // Merge guest cart items into authenticated user's cart
    const result = await mergeGuestCartToServer();
    if (result.remaining) setMessage(`Перенесено позиций: ${result.accepted}. Не перенесено: ${result.remaining}. Они сохранены на устройстве; повторите перенос в корзине.`);
    await refresh();
    router.refresh();
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
        notice: setMessage,
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
        <div className="toast" role="status" onClick={() => setMessage('')}>
          {message}
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const normalized = '+7' + phone.replace(/\D/g, '').slice(-10);
      if (sent) {
        await request('auth/phone-confirm', 'POST', { phone: normalized, code });
        await onSuccess();
      } else {
        const d = await request<{ codeLength?: number }>('auth/phone-login', 'POST', {
          phone: normalized,
          method: 'sms',
        });
        setLength(d.codeLength || 6);
        setSent(true);
        setResend(60);
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
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 900 000-00-00"
              minLength={11}
            />
          </label>
        ) : (
          <label>
            Код подтверждения
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`[0-9]{${length}}`}
              maxLength={length}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
        )}
        {error && <ErrorMessage message={error} />}
        <button className="primary" disabled={busy} type="submit">
          {busy ? 'Подождите…' : sent ? 'Войти' : 'Получить код'}
        </button>
        {sent && (
          <button
            type="button"
            className="text-button"
            disabled={resend > 0}
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            {resend > 0 ? `Повторить через ${resend} с` : 'Изменить номер или отправить код снова'}
          </button>
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
      <img src="/images/swallow.webp" alt="" width={64} height={64} />
      <h1>{title}</h1>
      <p>Ваши покупки, адреса и бонусы будут доступны после входа.</p>
      <button className="primary" onClick={s.login} type="button">
        Войти по телефону
      </button>
    </div>
  );
}

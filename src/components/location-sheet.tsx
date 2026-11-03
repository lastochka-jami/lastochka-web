'use client';

import { useState, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  MapPin,
  ChevronRight,
  Check,
  Plus,
  X,
  LoaderCircle,
} from 'lucide-react';
import { useShop } from './shop-context';
import { request } from '@/lib/client';
import { list, unwrap, cartChange, Store, Address } from '@/lib/types';

interface LocationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore?: Store | null;
  initialTab?: 'delivery' | 'pickup';
}

export type LocationMode = 'delivery' | 'pickup';

export interface LocationSelection {
  mode: LocationMode;
  label?: string;
}

export const LOCATION_OPEN_EVENT = 'lastochka:open-location';
export const LOCATION_CHANGED_EVENT = 'lastochka:location-changed';
export const LOCATION_MODE_STORAGE_KEY = 'lastochka:location-mode';

function isSelectableStore(store: Store) {
  return (
    store.id !== 8 &&
    store.name.trim().toLowerCase() !== 'default' &&
    store.isActive !== false
  );
}

export async function activateDeliveryAddressForStore(
  addressId: number,
  currentStoreId: number,
  label?: string,
) {
  const availableStores = list<Store>(
    await request(`stores?addressId=${addressId}&perPage=100`),
  ).filter(isSelectableStore);
  const store =
    availableStores.find((candidate) => candidate.id === currentStoreId) ?? availableStores[0];
  if (!store) throw new Error('Для этого адреса нет доступных магазинов доставки');

  const result = await request<any>('/api/store', 'POST', { storeId: store.id, addressId });
  if (Number(result?.store?.id) !== store.id) {
    throw new Error('Сервер выбрал другой магазин. Попробуйте ещё раз.');
  }
  await request(`addresses/${addressId}/active`, 'PUT');
  announceLocation({ mode: 'delivery', label });
  return result;
}

interface LocationTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  initialTab?: LocationMode;
}

export function LocationTrigger({
  children,
  initialTab = 'delivery',
  onClick,
  ...props
}: LocationTriggerProps) {
  return (
    <button
      {...props}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          window.dispatchEvent(
            new CustomEvent<LocationMode>(LOCATION_OPEN_EVENT, { detail: initialTab }),
          );
        }
      }}
    >
      {children}
    </button>
  );
}

function announceLocation(selection: LocationSelection) {
  window.localStorage.setItem(LOCATION_MODE_STORAGE_KEY, selection.mode);
  window.dispatchEvent(
    new CustomEvent<LocationSelection>(LOCATION_CHANGED_EVENT, { detail: selection }),
  );
}

export function LocationSheet({
  isOpen,
  onClose,
  currentStore,
  initialTab = 'delivery',
}: LocationSheetProps) {
  const s = useShop();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'delivery' | 'pickup'>(initialTab);
  const [stores, setStores] = useState<Store[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync initial tab when sheet opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab]);

  // Load stores and addresses
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const [storesResult, addressesResult] = await Promise.allSettled([
          request<any>('stores').then(list<Store>),
          s.authenticated
            ? request<any>('addresses').then(list<Address>)
            : Promise.resolve([] as Address[]),
        ]);

        if (storesResult.status === 'rejected') throw storesResult.reason;
        if (addressesResult.status === 'rejected') throw addressesResult.reason;

        const storesData = storesResult.value;
        const addressesData = addressesResult.value;

        if (isMounted) {
          // Filter out dummy/broken "default" stores and stores without addresses
          const validStores = storesData.filter(
            (st) =>
              st.id !== 8 &&
              st.name.trim().toLowerCase() !== 'default' &&
              Boolean(st.address?.trim()) &&
              st.isActive !== false,
          );
          setStores(validStores);
          setAddresses(addressesData);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Не удалось загрузить данные локации');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, s.authenticated]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Select pickup store
  async function selectPickupStore(storeId: number) {
    setBusy(true);
    setError(null);
    try {
      const beforeCart = s.cart;
      const result = await request<any>('/api/store', 'POST', { storeId });
      if (Number(result?.store?.id) !== storeId) {
        throw new Error('Сервер выбрал другой магазин. Попробуйте ещё раз.');
      }
      await s.refresh();
      s.notice(cartChange(beforeCart, result.cart) || `Самовывоз: ${result.store.name}`);
      announceLocation({
        mode: 'pickup',
        label: result.store.address || result.store.name,
      });
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка выбора магазина');
    } finally {
      setBusy(false);
    }
  }

  // Activate delivery address
  async function activateDeliveryAddress(addressId: number) {
    setBusy(true);
    setError(null);
    try {
      const beforeCart = s.cart;
      const result = await activateDeliveryAddressForStore(addressId, s.storeId);
      const afterCart = unwrap(result.cart ?? (await request('cart').catch(() => null)));
      await s.refresh();
      const refreshedAddresses = list<Address>(await request('addresses').catch(() => []));
      setAddresses(refreshedAddresses);
      const selectedAddress = addresses.find((address) => address.id === addressId);
      const addressLabel = selectedAddress
        ? [selectedAddress.city, selectedAddress.street, selectedAddress.houseNumber && `д. ${selectedAddress.houseNumber}`]
            .filter(Boolean)
            .join(', ')
        : undefined;
      announceLocation({ mode: 'delivery', label: addressLabel });
      s.notice(
        cartChange(beforeCart, afterCart) || 'Адрес доставки выбран. Каталог обновлён.',
      );
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка выбора адреса');
    } finally {
      setBusy(false);
    }
  }

  function handleAddAddress() {
    onClose();
    if (!s.authenticated) {
      s.login();
    } else {
      router.push('/addresses');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="location-sheet-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="location-sheet-container"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="location-sheet-drag-handle" aria-hidden="true">
          <span className="location-sheet-handle-bar" />
        </div>

        {/* Header with segmented switcher and close button */}
        <div className="location-sheet-header">
          <div className="location-segmented-tabs" role="tablist" aria-label="Тип получения">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'delivery'}
              className={`location-tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
              onClick={() => setActiveTab('delivery')}
            >
              Доставка
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pickup'}
              className={`location-tab-btn ${activeTab === 'pickup' ? 'active' : ''}`}
              onClick={() => setActiveTab('pickup')}
            >
              Самовывоз
            </button>
          </div>

          <button
            type="button"
            className="location-sheet-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error message if any */}
        {error && <div className="location-sheet-error">{error}</div>}

        {/* Content area */}
        <div className="location-sheet-body">
          {loading ? (
            <div className="location-sheet-loading">
              <LoaderCircle className="spin" size={24} />
              <span>Загрузка данных...</span>
            </div>
          ) : activeTab === 'pickup' ? (
            /* TAB: САМОВЫВОЗ */
            <div className="location-pickup-content">
              {stores.length === 0 ? (
                <div className="location-empty-state">
                  <p className="location-empty-text">Нет доступных пунктов самовывоза</p>
                </div>
              ) : (
                <div className="pickup-stores-list">
                  {stores.map((st) => {
                    const isSelected = currentStore?.id === st.id;
                    const addressText = st.address || st.name;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        className={`pickup-store-card ${isSelected ? 'selected' : ''}`}
                        disabled={busy}
                        onClick={() => selectPickupStore(st.id)}
                      >
                        <div className="pickup-store-icon-wrap">
                          <ShoppingBag size={20} className="pickup-store-icon" />
                        </div>
                        <div className="pickup-store-details">
                          <strong className="pickup-store-address">{addressText}</strong>
                        </div>
                        <div className="pickup-store-action">
                          {isSelected ? (
                            <span className="pickup-store-selected-badge" title="Выбран">
                              <Check size={18} />
                            </span>
                          ) : (
                            <ChevronRight size={18} className="pickup-store-chevron" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB: ДОСТАВКА */
            <div className="location-delivery-content">
              {addresses.length === 0 ? (
                <div className="location-empty-state">
                  <p className="location-empty-text">Нет сохраненных адресов</p>
                  <button
                    type="button"
                    className="location-add-address-btn"
                    onClick={handleAddAddress}
                  >
                    Добавить адрес
                  </button>
                </div>
              ) : (
                <div className="delivery-addresses-list">
                  {addresses.map((addr) => {
                    const isSelected = addr.isActive;
                    const fullAddress = [
                      addr.city,
                      addr.street,
                      addr.houseNumber && `д. ${addr.houseNumber}`,
                      addr.apartment && `кв. ${addr.apartment}`,
                    ]
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <button
                        key={addr.id}
                        type="button"
                        className={`delivery-address-card ${isSelected ? 'selected' : ''}`}
                        disabled={busy}
                        onClick={() => activateDeliveryAddress(addr.id)}
                      >
                        <div className="delivery-address-icon-wrap">
                          <MapPin size={18} className="delivery-address-icon" />
                        </div>
                        <div className="delivery-address-details">
                          <strong className="delivery-address-title">
                            {addr.title || fullAddress || 'Адрес доставки'}
                          </strong>
                          {addr.title && fullAddress && (
                            <span className="delivery-address-subtitle">{fullAddress}</span>
                          )}
                        </div>
                        <div className="delivery-address-action">
                          {isSelected ? (
                            <span className="delivery-address-selected-badge">
                              <Check size={18} />
                            </span>
                          ) : (
                            <ChevronRight size={18} className="delivery-address-chevron" />
                          )}
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="delivery-add-new-btn"
                    onClick={handleAddAddress}
                  >
                    <Plus size={16} /> Добавить новый адрес
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

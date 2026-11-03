'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Check } from 'lucide-react';
import { list, unwrap, cartChange, Address } from '@/lib/types';
import { request } from '@/lib/client';
import { activateDeliveryAddressForStore } from '@/components/location-sheet';
import { useShop } from '@/components/shop-context';
import { Modal, Empty } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';
import { AddressPickerMap, AddressCoordinates } from './address-picker-map';

export function AddressesView() {
  const remote = useRemote<Address[]>('addresses');
  const s = useShop();
  const router = useRouter();
  const [editingAddress, setEditingAddress] = useState<Partial<Address> | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<AddressCoordinates | null>(null);
  const [coordsConfirmed, setCoordsConfirmed] = useState(false);

  const addresses = list<Address>(remote.data);

  function startEdit(addr: Partial<Address>) {
    setEditingAddress(addr);
    // Require a fresh, explicit point selection because older records may contain fallback coordinates.
    setCoords(null);
    setCoordsConfirmed(false);
  }

  async function activateAddress(id: number) {
    const beforeCart = s.cart;
    await activateDeliveryAddressForStore(id, s.storeId, addresses.filter(a => a.id === id).map(a => [a.city, a.street, a.houseNumber].filter(Boolean).join(', '))[0]);
    const afterCart = unwrap(await request('cart'));
    await s.refresh();
    await remote.reload();
    router.refresh();
    s.notice(
      cartChange(beforeCart, afterCart) ||
        'Адрес выбран. Каталог, цены и корзина синхронизированы.',
    );
  }

  async function saveAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAddress) return;

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (
      !coords ||
      !Number.isFinite(coords.latitude) ||
      !Number.isFinite(coords.longitude) ||
      coords.latitude < -90 || coords.latitude > 90 ||
      coords.longitude < -180 || coords.longitude > 180
    ) {
      s.notice('Выберите точку доставки на карте');
      return;
    }
    if (!coordsConfirmed) {
      s.notice('Подтвердите, что точка соответствует указанному адресу');
      return;
    }

    setBusy(true);
    await s
      .run(async () => {
        const payload = {
          ...data,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        const saved = unwrap<Address>(await request(
          editingAddress.id ? `addresses/${editingAddress.id}` : 'addresses',
          editingAddress.id ? 'PUT' : 'POST', payload,
        ));
        // Creation already commits an active address on the backend. Close the
        // editor before reconciliation so a failed store lookup cannot create a duplicate.
        setEditingAddress(null);
        await remote.reload();
        if (saved?.isActive) {
          try { await activateAddress(saved.id); }
          catch (error) { throw new Error(`Адрес сохранён, но магазин не удалось согласовать: ${(error as Error).message}`); }
        }
        s.notice('Адрес сохранён');
      })
      .finally(() => setBusy(false));
  }

  async function deleteAddress(id: number) {
    if (!confirm('Удалить этот адрес?')) return;
    await s.run(async () => {
      await request(`addresses/${id}`, 'DELETE');
      setEditingAddress(null);
      await remote.reload();
      s.notice('Адрес удалён');
    });
  }

  return (
    <div className="account-section">
      <div className="section-header">
        <div>
          <h1>Адреса доставки</h1>
          <p className="muted">Адрес определяет доступные магазины, стоимость и интервалы доставки.</p>
        </div>
        <button className="primary" onClick={() => startEdit({})} type="button">
          <Plus size={18} /> Добавить адрес
        </button>
      </div>

      <RemoteState r={remote}>
        <div className="addresses-list">
          {addresses.map((addr) => (
            <div className={`panel address-card ${addr.isActive ? 'active-address' : ''}`} key={addr.id}>
              <div className="address-icon">
                <MapPin size={22} />
              </div>
              <div className="address-details">
                <div className="address-title-row">
                  <h3>{addr.title || addr.city || 'Адрес доставки'}</h3>
                  {addr.isActive && (
                    <span className="active-badge">
                      <Check size={14} /> Выбран
                    </span>
                  )}
                </div>
                <p>
                  {[
                    addr.city,
                    addr.street,
                    addr.houseNumber && `д. ${addr.houseNumber}`,
                    addr.apartment && `кв. ${addr.apartment}`,
                    addr.entrance && `подъезд ${addr.entrance}`,
                    addr.floor && `этаж ${addr.floor}`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {addr.comment && <p className="address-comment muted">«{addr.comment}»</p>}
                <div className="address-actions">
                  {!addr.isActive && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => s.run(() => activateAddress(addr.id))}
                    >
                      Доставить сюда
                    </button>
                  )}
                  <button className="text-button" type="button" onClick={() => startEdit(addr)}>
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!addresses.length && (
            <Empty title="У вас пока нет сохранённых адресов">
              <p className="muted">Добавьте адрес доставки, чтобы видеть точные интервалы и стоимость</p>
              <button
                className="primary"
                onClick={() => startEdit({})}
                type="button"
                style={{ marginTop: 12 }}
              >
                <Plus size={18} /> Добавить адрес
              </button>
            </Empty>
          )}
        </div>
      </RemoteState>

      {editingAddress && (
        <Modal
          title={editingAddress.id ? 'Изменить адрес доставки' : 'Новый адрес доставки'}
          onClose={() => setEditingAddress(null)}
          wide
        >
          <form className="stack address-form" onSubmit={saveAddress}>
            <div className="form-grid">
              <label>
                Название адреса
                <input
                  name="title"
                  defaultValue={editingAddress.title || ''}
                  placeholder="Дом, работа и т.д."
                />
              </label>

              <label>
                Город
                <input
                  name="city"
                  defaultValue={editingAddress.city || 'Нальчик'}
                  required
                  placeholder="Нальчик"
                  onChange={() => setCoordsConfirmed(false)}
                />
              </label>

              <label>
                Улица
                <input
                  name="street"
                  defaultValue={editingAddress.street || ''}
                  required
                  placeholder="ул. Ленина"
                  onChange={() => setCoordsConfirmed(false)}
                />
              </label>

              <label>
                Дом
                <input
                  name="houseNumber"
                  defaultValue={editingAddress.houseNumber || ''}
                  required
                  placeholder="10"
                  onChange={() => setCoordsConfirmed(false)}
                />
              </label>

              <label>
                Квартира / Офис
                <input
                  name="apartment"
                  defaultValue={editingAddress.apartment || ''}
                  placeholder="42"
                />
              </label>

              <label>
                Подъезд
                <input
                  name="entrance"
                  defaultValue={editingAddress.entrance || ''}
                  placeholder="1"
                />
              </label>

              <label>
                Этаж
                <input
                  name="floor"
                  defaultValue={editingAddress.floor || ''}
                  placeholder="4"
                />
              </label>

              <label>
                Домофон
                <input
                  name="intercom"
                  defaultValue={editingAddress.intercom || ''}
                  placeholder="42#"
                />
              </label>
            </div>

            <label>
              Комментарий для курьера
              <textarea
                name="comment"
                defaultValue={editingAddress.comment || ''}
                placeholder="Как быстрее пройти, код калитки или ориентир"
                maxLength={500}
              />
            </label>

            <div className="map-picker-section">
              <label className="picker-label">Точка на карте</label>
              <AddressPickerMap
                initialLat={coords?.latitude}
                initialLng={coords?.longitude}
                city={editingAddress.city}
                street={editingAddress.street}
                house={editingAddress.houseNumber}
                onLocationSelect={(point) => {
                  setCoords(point);
                  setCoordsConfirmed(false);
                }}
              />
              <label className="address-coordinate-confirmation">
                <input
                  type="checkbox"
                  checked={coordsConfirmed}
                  onChange={(event) => setCoordsConfirmed(event.target.checked)}
                  required
                />
                Точка на карте соответствует указанным городу, улице и дому
              </label>
            </div>

            <div className="form-buttons-row">
              <button className="primary" disabled={busy} type="submit">
                {busy ? 'Сохраняем…' : 'Сохранить адрес'}
              </button>

              {editingAddress.id && (
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => deleteAddress(editingAddress.id!)}
                >
                  Удалить адрес
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

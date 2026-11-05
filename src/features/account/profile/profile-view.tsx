'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  MapPin,
  ChevronRight,
  LogOut,
  Bell,
  Plus,
} from 'lucide-react';
import { unwrap, list, type Address, UserProfileDto, LoyaltyCardDto } from '@/lib/types';
import { useShop } from '@/components/shop-context';
import { Modal } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function ProfileView() {
  const remote = useRemote<UserProfileDto>('auth/profile');
  const loyaltyRemote = useRemote<LoyaltyCardDto>('loyalty-card');
  const addressesRemote = useRemote<Address[]>('addresses');
  const addresses = list<Address>(addressesRemote.data);
  const s = useShop();
  const [bonusModalOpen, setBonusModalOpen] = useState(false);

  const profile = unwrap<UserProfileDto>(remote.data);
  const cardData = unwrap<LoyaltyCardDto>(loyaltyRemote.data);

  const balanceNumber =
    s.authenticated && typeof cardData?.balance === 'number'
      ? cardData.balance
      : 0;

  return (
    <div className="account-section profile-page">
      {/* Mobile Top Profile Bar */}
      <div className="profile-mobile-header">
        <h1>Профиль</h1>
        <div className="profile-header-actions">
          <Link href="/notifications" className="profile-action-icon" aria-label="Уведомления">
            <Bell size={22} />
          </Link>
          <button
            className="profile-action-icon"
            onClick={s.logout}
            type="button"
            aria-label="Выйти"
          >
            <LogOut size={22} />
          </button>
        </div>
      </div>

      <RemoteState r={remote}>
        <div className="native-profile-container">
          {/* Card 1: Phone Card with Settings Chevron */}
          <Link href="/profile/settings" className="native-profile-card native-phone-card">
            <div className="native-phone-info">
              <strong className="native-phone-number">
                {profile?.phone || 'Номер не указан'}
              </strong>
              <span className="native-phone-sub">
                {profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : 'Покупатель'}
              </span>
            </div>
            <ChevronRight size={22} className="native-card-chevron" />
          </Link>

          {/* Card 2: Bonus Block */}
          <div className="native-profile-card native-bonus-card">
            <div className="native-bonus-left">
              <strong className="native-bonus-value">{balanceNumber}</strong>
              <span className="native-bonus-unit">бонусов</span>
            </div>
            <button
              type="button"
              className="native-bonus-link"
              onClick={() => setBonusModalOpen(true)}
            >
              Как получить бонусы?
            </button>
          </div>

          {/* Section: My Orders */}
          <div className="native-section-row">
            <h2 className="native-section-title">Мои заказы</h2>
            <Link href="/orders" className="native-section-action-link">
              Все заказы
            </Link>
          </div>

          {/* Section: Promotions & Promocodes */}
          <Link href="/promotions" className="native-action-bar-row">
            <span className="native-bar-title">Акции и промокоды</span>
            <ChevronRight size={22} className="native-bar-chevron" />
          </Link>

          {/* Section: Payment Methods with Round Plus */}
          <div className="native-action-bar-row">
            <Link href="/cards" className="native-bar-left-link">
              <CreditCard size={22} />
              <span className="native-bar-title">Способы оплаты</span>
            </Link>
            <Link href="/cards" className="native-round-plus-btn" aria-label="Добавить способ оплаты">
              <Plus size={20} />
            </Link>
          </div>

          {/* Section: Delivery Addresses with Round Plus */}
          <div className="native-action-bar-block">
            <div className="native-action-bar-row">
              <Link href="/addresses" className="native-bar-left-link">
                <span className="native-bar-title">Адреса доставки</span>
              </Link>
              <Link href="/addresses" className="native-round-plus-btn" aria-label="Добавить адрес доставки">
                <Plus size={20} />
              </Link>
            </div>
            {!addressesRemote.loading && !addressesRemote.error && (
              <span className="native-sub-hint">{addresses.length ? `Сохранённых адресов: ${addresses.length}` : 'Нет адресов доставки'}</span>
            )}
          </div>

          {/* Bottom Pills */}
          <div className="native-bottom-pills-row">
            <Link href="/faq" className="native-bottom-pill">
              Поддержка
            </Link>
            <Link href="/faq" className="native-bottom-pill">
              Вопросы и ответы
            </Link>
            <Link href="/info" className="native-bottom-pill">
              Документы
            </Link>
          </div>
        </div>

        {bonusModalOpen && (
          <Modal title="Программа лояльности «Ласточка»" onClose={() => setBonusModalOpen(false)}>
            <div className="bonuses-info-modal">
              <div className="bonus-info-item">
                <span className="bonus-info-badge">1</span>
                <div>
                  <strong>Кэшбэк бонусами за каждый заказ</strong>
                  <p className="muted">Возвращаем до 5% от суммы покупки бонусами на ваш баланс.</p>
                </div>
              </div>
              <div className="bonus-info-item">
                <span className="bonus-info-badge">2</span>
                <div>
                  <strong>1 бонус = 1 рубль</strong>
                  <p className="muted">Бонусы не сгорают при регулярных покупках и равны реальным рублям.</p>
                </div>
              </div>
              <div className="bonus-info-item">
                <span className="bonus-info-badge">3</span>
                <div>
                  <strong>Оплата до 50% чека</strong>
                  <p className="muted">Списывайте накопленные бонусы на кассе в магазине или при онлайн-заказе.</p>
                </div>
              </div>
              <button
                type="button"
                className="primary block bonus-close-btn"
                onClick={() => setBonusModalOpen(false)}
              >
                Понятно
              </button>
            </div>
          </Modal>
        )}
      </RemoteState>
    </div>
  );
}

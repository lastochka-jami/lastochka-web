'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import { QrCode, Gift, Smartphone, ArrowRight } from 'lucide-react';
import { useShop } from '@/components/shop-context';
import { unwrap, LoyaltyCardDto } from '@/lib/types';
import { Modal } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function LoyaltyCard({ compact = false }: { compact?: boolean }) {
  const s = useShop();
  const remote = useRemote<LoyaltyCardDto>(s.authenticated ? 'loyalty-card' : null);
  const [modalOpen, setModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const cardData = unwrap<LoyaltyCardDto>(remote.data);

  useEffect(() => {
    setQrCodeDataUrl('');
    if (cardData?.status !== 'active' || !cardData.qrPayload?.trim()) return;

    let cancelled = false;
    const payload = cardData.qrPayload.trim();
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
    }))
      .then((dataUrl) => {
        if (!cancelled) setQrCodeDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrCodeDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [cardData?.status, cardData?.qrPayload]);

  const handleCardClick = () => {
    if (!s.authenticated) {
      s.login();
    } else {
      setModalOpen(true);
    }
  };

  const balanceNumber =
    s.authenticated && typeof cardData?.balance === 'number'
      ? Math.trunc(cardData.balance)
      : 0;
  const formattedBalance = `${balanceNumber.toLocaleString('ru-RU')} бонусов`;

  return (
    <>
      <div className={`loyalty-native-card ${compact ? 'compact' : ''}`}>
        <div className="loyalty-native-left">
          <div className="loyalty-bonus-pill" onClick={handleCardClick} role="button" tabIndex={0}>
            <div className="loyalty-bonus-info">
              <span className="loyalty-icon-home">⌂</span>
              <div>
                <span className="loyalty-label-text">Бонусы</span>
                <strong className="loyalty-number-text">{balanceNumber}</strong>
              </div>
            </div>
            <span className="loyalty-hint-text">Копите<br />и тратьте</span>
          </div>

          <Link href="/promotions" className="loyalty-promotions-pill">
            <span className="loyalty-icon-home">⌂</span>
            <span className="loyalty-promotions-text">Акции и промокоды</span>
          </Link>
        </div>

        <div className="loyalty-native-right">
          <button
            type="button"
            className="loyalty-qr-frame"
            onClick={handleCardClick}
            aria-label="QR-код карты постоянного покупателя"
          >
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR-код карты" className="loyalty-qr-img" width={110} height={110} />
            ) : (
              <QrCode size={64} />
            )}
          </button>
        </div>
      </div>

      {infoModalOpen && (
        <Modal title="Программа лояльности «Ласточка»" onClose={() => setInfoModalOpen(false)}>
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
              onClick={() => setInfoModalOpen(false)}
            >
              Понятно
            </button>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal title="Ваша карта лояльности" onClose={() => setModalOpen(false)}>
          <RemoteState r={remote}>
            {qrCodeDataUrl ? (
              <div className="qr-panel">
                <img src={qrCodeDataUrl} alt="QR-код карты лояльности" />
                {cardData?.cardNumber && <p className="card-num">{cardData.cardNumber}</p>}
                <strong>{formattedBalance}</strong>
                <p className="muted">Покажите QR-код на кассе для начисления и списания</p>
              </div>
            ) : (
              <p>Карта готовится. QR-код появится после подтверждения магазином.</p>
            )}
          </RemoteState>
          <div className="modal-footer-link">
            <Link href="/bonuses" onClick={() => setModalOpen(false)}>
              История начислений и списаний →
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}

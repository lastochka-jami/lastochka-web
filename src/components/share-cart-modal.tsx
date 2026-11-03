'use client';

import { useState, useEffect } from 'react';
import { encodeSharedCart } from '@/lib/shared-cart';
import { Copy, Check, X, Share2 } from 'lucide-react';
import { CartItem } from '@/lib/types';
import { useShop } from './shop-context';

interface ShareCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
}

export function ShareCartModal({ isOpen, onClose, items }: ShareCartModalProps) {
  const s = useShop();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !items.length) return;

    let pairs: string;
    try { pairs = encodeSharedCart(items); }
    catch (e) { s.notice((e as Error).message); return; }
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://lastochki.store';
    const link = `${origin}/share-cart#${pairs}`;

    setShareLink(link);

    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(link, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000ff',
        light: '#ffffffff',
      },
      errorCorrectionLevel: 'M',
    }))
      .then((url) => setQrUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [isOpen, items]);

  if (!isOpen) return null;

  async function handleCopy() {
    if (!shareLink) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      s.notice('Ссылка на корзину скопирована');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      s.notice('Не удалось скопировать ссылку');
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Корзина в Ласточке',
          text: 'Смотрите, какие товары я собрал в Ласточке:',
          url: shareLink,
        });
      } catch {
        // Dismissed by user
      }
    } else {
      handleCopy();
    }
  }

  return (
    <div className="share-cart-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="share-cart-sheet"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button
          type="button"
          className="share-cart-close-btn"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>

        <div className="share-cart-content">
          <h2 className="share-cart-title">Поделитесь корзиной с другим человеком</h2>
          <p className="share-cart-subtitle">
            Отправьте ссылку или покажите QR-код и продукты окажутся у него в корзине
          </p>

          <div className="share-cart-qr-wrapper">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR-код корзины"
                className="share-cart-qr-img"
                width={240}
                height={240}
              />
            ) : (
              <div className="share-cart-qr-skeleton" />
            )}
          </div>

          <div className="share-cart-actions">
            <button
              type="button"
              className="primary share-cart-copy-btn"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check size={19} />
                  Ссылка скопирована
                </>
              ) : (
                'Копировать ссылку'
              )}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                className="secondary share-cart-native-btn"
                onClick={handleNativeShare}
              >
                <Share2 size={18} />
                Отправить через...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { list, unwrap, PaymentCardDto } from '@/lib/types';
import { paymentReturnUrl, request } from '@/lib/client';
import { useShop } from '@/components/shop-context';
import { Modal, Empty } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';
import { goPayment } from '../orders/orders-view';
import { BINDING_STORAGE_KEY, readPendingBinding, bindingError, checkBinding } from '@/lib/card-binding';

export function CardsView() {
  const remote = useRemote<PaymentCardDto[]>('payment-cards');
  const s = useShop();
  const [bindModal, setBindModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bindError, setBindError] = useState('');
  const bindLock = useRef(false);
  const params = useSearchParams();

  const [verification, setVerification] = useState('');
  const [checking, setChecking] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const returned = params.has('binding') || params.has('status');
  const userId = s.profile.data?.id;
  const reloadCards = remote.reload;

  useEffect(() => {
    setVerification('');
    setChecking(false);
    setRetryAvailable(false);
    if (!s.authenticated || !userId) return;
    const pending = readPendingBinding(sessionStorage.getItem(BINDING_STORAGE_KEY), userId);
    if (!returned && !pending && !checkVersion) return;
    const controller = new AbortController();
    setChecking(true);
    setVerification('Проверяем привязку карты. Ожидаем подтверждения платёжного сервиса…');
    void checkBinding({ load: reloadCards, baseline: pending?.cardIds ?? null, signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setChecking(false);
        setRetryAvailable(result !== 'confirmed');
        if (result === 'confirmed') {
          sessionStorage.removeItem(BINDING_STORAGE_KEY);
          setVerification('Карта привязана. Список карт обновлён.');
        } else if (result === 'unavailable') {
          setVerification('Не удалось проверить привязку. Проверьте соединение и повторите проверку.');
        } else {
          setVerification('Привязка пока не подтверждена. Если вы завершили её в банке, повторите проверку позже.');
        }
      });
    return () => controller.abort();
  }, [returned, userId, s.authenticated, s.authKey, reloadCards, checkVersion]);

  const cards = list<PaymentCardDto>(remote.data);

  return (
    <div className="account-section">
      <div className="section-header">
        <div>
          <h1>Способы оплаты</h1>
          <p className="muted">Сохранённые банковские карты для быстрой оплаты заказов.</p>
        </div>
        <button className="primary" disabled={checking} onClick={() => setBindModal(true)} type="button">
          <Plus size={18} /> Привязать карту
        </button>
      </div>

      {verification && <div className="panel" role="status">
        <p>{verification}</p>
        {!checking && retryAvailable && <button type="button" className="text-button" onClick={() => setCheckVersion(value => value + 1)}>Проверить ещё раз</button>}
      </div>}
      <RemoteState r={remote}>
        <div className="cards-list">
          {cards.length ? (
            cards.map((c) => (
              <div className="panel card-row" key={c.id}>
                <div className="card-info">
                  <CreditCard size={22} />
                  <strong>
                    {c.cardType || c.type || 'Карта'} •••• {c.last4 || c.lastFour || '0000'}
                  </strong>
                </div>
                <button
                  className="icon-button danger"
                  aria-label="Удалить карту"
                  type="button"
                  onClick={() => {
                    if (confirm('Удалить эту привязанную карту?')) {
                      void s.run(async () => {
                        await request(`payment-cards/${c.id}`, 'DELETE');
                        await remote.reload();
                        s.notice('Карта удалена');
                      });
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <Empty title="У вас пока нет сохранённых карт">
              <p className="muted">Привяжите карту для быстрой и удобной оплаты заказов онлайн</p>
            </Empty>
          )}
        </div>
      </RemoteState>

      {bindModal && (
        <Modal title="Привязать банковскую карту" onClose={() => { setBindModal(false); setBindError(''); }}>
          <div className="stack">
            <p>
              Вы перейдёте на защищённую страницу платёжного сервиса. Для проверки карты будет
              произведён тестовый холд 1 ₽, который сразу вернётся на счёт.
            </p>
            {bindError && (
              <div className="error bind-error-box" role="alert">
                <p><strong>Ошибка привязки:</strong> {bindError}</p>
              </div>
            )}
            <button
              className="primary"
              disabled={busy || checking || !userId || remote.loading || !!remote.error}
              type="button"
              onClick={async () => {
                if (bindLock.current) return;
                bindLock.current = true;
                setBusy(true);
                setBindError('');
                try {
                  // Capture server state before leaving this browser tab, scoped to this account.
                  const before = await request('payment-cards');
                  const data = unwrap<any>(await request('payment-cards/bind', 'POST', {
                    returnUrl: paymentReturnUrl('/cards?binding=return', s.publicOrigin),
                  }));
                  if (typeof data?.confirmationUrl !== 'string' || new URL(data.confirmationUrl).protocol !== 'https:') {
                    throw new Error('Платёжная ссылка не получена. Попробуйте ещё раз.');
                  }
                  sessionStorage.setItem(BINDING_STORAGE_KEY, JSON.stringify({
                    userId, cardIds: list<PaymentCardDto>(before).map(card => card.id), startedAt: Date.now(),
                  }));
                  goPayment(data.confirmationUrl);
                } catch (err: any) {
                  setBindError(bindingError(err));
                  bindLock.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Переходим…' : 'Перейти к привязке карты'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

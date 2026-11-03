'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Package, ChevronRight, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { list, unwrap, money, OrderDto, OrderItemDto } from '@/lib/types';
import { paymentReturnUrl, request } from '@/lib/client';
import { useShop } from '@/components/shop-context';
import { Empty, ErrorMessage } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function goPayment(url: unknown) {
  if (typeof url !== 'string') {
    throw new Error('Платёжная ссылка не получена. Обновите статус заказа.');
  }
  const u = new URL(url);
  if (u.protocol !== 'https:') {
    throw new Error('Некорректная ссылка оплаты');
  }
  location.assign(u.toString());
}

const statusLabels: Record<string, string> = {
  draft: 'Ожидает оплаты',
  pending: 'Ожидает подтверждения',
  new: 'Новый',
  confirmed: 'Подтверждён',
  processing: 'Собирается',
  assembling: 'Собирается',
  ready: 'Готов к выдаче',
  delivering: 'В пути',
  completed: 'Завершён',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
  canceled: 'Отменён',
};

export function OrdersView({
  id: requestedId,
  paymentReturn = false,
}: {
  id?: string;
  paymentReturn?: boolean;
}) {
  const [storedId, setStoredId] = useState<string>();
  useEffect(() => {
    if (!paymentReturn || requestedId) return;
    const stored = sessionStorage.getItem('last-order');
    if (stored && /^\d+$/.test(stored)) setStoredId(stored);
  }, [paymentReturn, requestedId]);
  const id = requestedId || storedId;
  const remote = useRemote<any>(id ? `orders/${id}` : !paymentReturn ? 'orders?perPage=50' : null);
  const paymentStatus = useRemote<any>(id ? `orders/${id}/payment-status` : null);
  const receipts = useRemote<any>(id ? `orders/${id}/receipts` : null);
  const s = useShop();
  const order = id ? unwrap<OrderDto>(remote.data) : null;
  const ordersList = !id ? list<OrderDto>(remote.data) : [];
  const orderId = id;
  const reloadOrder = remote.reload;
  const reloadPaymentStatus = paymentStatus.reload;
  const pollingState = useRef({ isPaid: false, status: '', paymentState: '' });

  pollingState.current = {
    isPaid: Boolean(order?.isPaid || unwrap<any>(paymentStatus.data)?.isPaid),
    status: order?.status || unwrap<any>(paymentStatus.data)?.status || '',
    paymentState: unwrap<any>(paymentStatus.data)?.paymentState || '',
  };

  useEffect(() => {
    if (!paymentReturn || !id) return;
    let count = 0;
    const interval = setInterval(() => {
      const current = pollingState.current;
      const terminal = ['cancelled', 'canceled', 'delivered', 'completed', 'failed'].includes(
        current.status,
      ) || ['failed', 'cancelled', 'confirmed'].includes(current.paymentState);
      if (current.isPaid || terminal || count >= 12) {
        clearInterval(interval);
        return;
      }
      count += 1;
      void reloadOrder();
      void reloadPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [id, paymentReturn, reloadOrder, reloadPaymentStatus]);

  return (
    <div className="account-section">
      <div className="section-header">
        <h1>{orderId ? `Заказ № ${orderId}` : 'Мои заказы'}</h1>
        {orderId && (
          <Link href="/orders" className="text-button">
            ← Ко всем заказам
          </Link>
        )}
      </div>

      {paymentReturn && (
        <div className="notice-banner">
          <AlertCircle size={18} />
          <span>Возвращение со шлюза оплаты. Проверяем статус заказа в магазине.</span>
        </div>
      )}

      {paymentReturn && !id && <p className="error">В ссылке нет номера заказа. Откройте нужный заказ в <Link href="/orders">истории заказов</Link>.</p>}
      <RemoteState r={remote}>
        {orderId && order ? (
          <div className="order-detail-layout">
            <div className="panel order-card-main">
              <div className="order-status-row">
                <span className={`status-pill status-${order.status}`}>
                  {statusLabels[order.status] || order.status}
                </span>
                <span className={`payment-pill ${order.isPaid ? 'paid' : 'unpaid'}`}>
                  {order.isPaid ? 'Оплачен' : 'Оплата не подтверждена'}
                </span>
              </div>

              <h2>Итого: {money(order.total)}</h2>

              {order.paymentDeclineReason && (
                <ErrorMessage
                  message={
                    order.paymentDeclineReason === 'insufficient_funds'
                      ? 'Недостаточно средств на карте'
                      : 'Оплата отклонена банком'
                  }
                />
              )}

              {order.deliverySlotDate && (
                <p className="order-slot muted">
                  Слот доставки: {order.deliverySlotDate} {order.deliverySlotTimeSlot || ''}
                </p>
              )}

              <div className="order-items-list">
                <h3>Состав заказа</h3>
                {order.items?.map((item: OrderItemDto) => {
                  const orderItem = item as OrderItemDto & {
                    displayQuantity?: string;
                    measurementUnitLabel?: string;
                    supplements?: Array<{
                      title?: string | null;
                      values?: Array<{ title?: string; quantity?: number }>;
                    }>;
                  };
                  const quantity = orderItem.displayQuantity ||
                    `${item.quantity}${orderItem.measurementUnitLabel ? ` ${orderItem.measurementUnitLabel}` : ''}`;
                  return (
                    <div className="order-item-row" key={item.id}>
                      <div>
                        <span>{item.product?.title || item.title || item.productTitle} × {quantity}</span>
                        {orderItem.supplements?.map((supplement, index) => {
                          const values = supplement.values?.map((value) =>
                            `${value.title || ''}${value.quantity && value.quantity > 1 ? ` × ${value.quantity}` : ''}`,
                          ).filter(Boolean).join(', ');
                          const label = [supplement.title, values].filter(Boolean).join(': ');
                          return label ? <small className="muted" key={`${item.id}-supp-${index}`}>{label}</small> : null;
                        })}
                      </div>
                      <strong>{money(item.total ?? item.price)}</strong>
                    </div>
                  );
                })}
              </div>

              <dl className="totals">
                {typeof order.subtotal === 'number' && (
                  <>
                    <dt>Товары</dt>
                    <dd>{money(order.subtotal)}</dd>
                  </>
                )}
                {typeof order.discount === 'number' && order.discount > 0 && (
                  <>
                    <dt>Скидка</dt>
                    <dd>{money(order.discount)}</dd>
                  </>
                )}
                {typeof order.deliveryCost === 'number' && (
                  <>
                    <dt>Доставка</dt>
                    <dd>{money(order.deliveryCost)}</dd>
                  </>
                )}
                {typeof (order as any).assemblyCost === 'number' && (
                  <>
                    <dt>Сборка</dt>
                    <dd>{money((order as any).assemblyCost)}</dd>
                  </>
                )}
                <dt>Итого к оплате</dt>
                <dd>
                  <strong>{money(order.total)}</strong>
                </dd>
              </dl>

              <div className="order-action-buttons">
                <button
                  className="secondary"
                  onClick={() => {
                    void remote.reload();
                    void paymentStatus.reload();
                  }}
                  type="button"
                >
                  <RefreshCw size={16} /> Обновить статус
                </button>

                {id && !order.isPaid &&
                  ['draft', 'pending', 'new', 'awaiting_payment'].includes(order.status) && (
                    <button
                      className="primary"
                      type="button"
                      onClick={() =>
                        s.run(async () => {
                          const result = await request<any>(`orders/${id}/pay`, 'POST', {
                            returnUrl: paymentReturnUrl(`/payment?orderId=${id}`, s.publicOrigin),
                          });
                          goPayment(result.confirmationUrl);
                        })
                      }
                    >
                      Оплатить заказ онлайн
                    </button>
                  )}

                {order.canCancel === true && (
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => {
                      if (confirm('Вы уверены, что хотите отменить этот заказ?')) {
                        void s.run(async () => {
                          await request(`orders/${id}/cancel`, 'POST');
                          await remote.reload();
                        });
                      }
                    }}
                  >
                    Отменить заказ
                  </button>
                )}
              </div>
            </div>

            {receipts.data && list(receipts.data).length > 0 && (
              <div className="panel receipts-panel">
                <h3>
                  <FileText size={18} /> Электронные чеки
                </h3>
                <div className="receipt-links">
                  {list(receipts.data).map((rec: any) => (
                    <a
                      key={rec.id}
                      className="secondary receipt-button"
                      href={rec.url || rec.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть чек № {rec.id} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : ordersList.length ? (
          <div className="orders-list">
            {ordersList.map((o) => (
              <Link className="panel order-row" href={`/orders/${o.id}`} key={o.id}>
                <div className="order-row-icon">
                  <Package size={22} />
                </div>
                <div className="order-row-info">
                  <strong>Заказ № {o.id}</strong>
                  <small className="muted">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('ru-RU') : ''} ·{' '}
                    {statusLabels[o.status] || o.status}
                  </small>
                </div>
                <div className="order-row-price">
                  <strong>{money(o.total)}</strong>
                  <ChevronRight size={18} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Здесь появятся ваши заказы">
            <p>Вы пока не оформляли заказы в нашем магазине.</p>
            <Link className="primary" href="/catalog">
              Начать покупки
            </Link>
          </Empty>
        )}
      </RemoteState>
    </div>
  );
}

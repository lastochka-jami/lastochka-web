'use client';

import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { list, unwrap, NotificationDto } from '@/lib/types';
import { request } from '@/lib/client';
import { useShop } from '@/components/shop-context';
import { notificationText } from '@/lib/notification-text';
import { Empty, Modal, Photo } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function NotificationsView() {
  const remote = useRemote<NotificationDto[]>('notifications?perPage=50');
  const s = useShop();
  const [selectedNotification, setSelectedNotification] = useState<NotificationDto | null>(null);

  const [busy, setBusy] = useState(false);
  const notifications = list<NotificationDto>(remote.data);

  const markAllRead = async () => {
    if (busy) return;
    setBusy(true);
    try { await s.run(async () => {
      await request('notifications/read-all', 'PATCH');
      await remote.reload();
      s.notice('Все уведомления прочитаны');
    }); } finally { setBusy(false); }
  };

  const openNotification = async (n: NotificationDto) => {
    if (busy) return;
    setBusy(true);
    try { await s.run(async () => {
      const detail = unwrap<NotificationDto>(await request(`notifications/${n.id}`));
      setSelectedNotification(detail);
      if (!n.isRead) await request(`notifications/${n.id}/read`, 'PATCH');
      await remote.reload();
    }); } finally { setBusy(false); }
  };

  return (
    <div className="account-section notifications-page">
      <div className="section-header">
        <div>
          <h1>Уведомления</h1>
          <p className="muted">Статусы ваших заказов, персональные предложения и новости.</p>
        </div>
        {notifications.length > 0 && (
          <button className="secondary notifications-read-all" aria-label="Прочитать все уведомления" disabled={busy || notifications.every(n => n.isRead)} onClick={markAllRead} type="button">
            <CheckCheck size={16} /> Прочитать все
          </button>
        )}
      </div>

      <RemoteState r={remote}>
        <div className="notifications-list">
          {notifications.length ? (
            notifications.map((n, index) => {
              const date = n.createdAt ? new Date(n.createdAt) : null;
              const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
              const dateKey = validDate?.toDateString();
              const previous = notifications[index - 1]?.createdAt;
              const showDate = index === 0 || dateKey !== (previous ? new Date(previous).toDateString() : undefined);
              return (
                <div className="notification-group" key={n.id}>
                  {showDate && <h2 className="notification-day">{validDate ? validDate.toLocaleDateString('ru-RU', {day:'numeric', month:'long'}) : 'Без даты'}</h2>}
                  <button className={`panel notification-item ${!n.isRead ? 'unread' : ''}`}
                    onClick={() => openNotification(n)} disabled={busy} type="button">
                    <span className="notif-unread-dot" aria-label={!n.isRead ? 'Не прочитано' : undefined} />
                    <span className="notif-image">
                      {n.imageUrl ? <Photo src={n.imageUrl} alt="" width={56} height={56} /> : <Bell size={22} />}
                    </span>
                    <span className="notif-content">
                      <strong>{n.title}</strong>
                      <span className="notif-preview">{notificationText(n.shortDescription) || notificationText(n.body || n.text)}</span>
                      <span className="notif-view">Смотреть</span>
                    </span>
                    {validDate && <time className="notif-time" dateTime={n.createdAt}>{validDate.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</time>}
                  </button>
                </div>
              );
            })
          ) : (
            <Empty title="Пока нет уведомлений">
              <p>Здесь появятся сообщения о статусах заказов и выгодных акциях.</p>
            </Empty>
          )}
        </div>
      </RemoteState>

      {selectedNotification && (
        <Modal
          title={selectedNotification.title || 'Уведомление'}
          onClose={() => setSelectedNotification(null)}
        >
          <div className="notification-modal-content">
            {selectedNotification.imageUrl && <Photo src={selectedNotification.imageUrl} alt="" width={600} height={400} className="notification-detail-image" />}
            <p className="notification-detail-text">{notificationText(selectedNotification.body || selectedNotification.text) || notificationText(selectedNotification.shortDescription)}</p>
            {selectedNotification.createdAt && (
              <small className="muted">
                {new Date(selectedNotification.createdAt).toLocaleString('ru-RU')}
              </small>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

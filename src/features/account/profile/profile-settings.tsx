'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { unwrap, UserProfileDto, UserNotificationSettingsDto } from '@/lib/types';
import { request } from '@/lib/client';
import { useShop } from '@/components/shop-context';
import { Modal, ErrorMessage } from '@/components/ui';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function ProfileSettingsView() {
  const s = useShop();
  const profileRemote = s.profile;
  const notifRemote = useRemote<UserNotificationSettingsDto>('users/me/notification-settings');
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [dangerModal, setDangerModal] = useState(false);
  const [changePhoneModal, setChangePhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const profile = unwrap<UserProfileDto>(profileRemote.data);
  const notifSettings = unwrap<UserNotificationSettingsDto>(notifRemote.data);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setBusy(true);
    await s
      .run(async () => {
        const payload = Object.fromEntries(
          [...formData.entries()].map(([k, v]) => [k, v ? String(v) : null]),
        );
        await request('auth/profile', 'PUT', payload);
        s.notice('Профиль сохранён');
        await profileRemote.reload();
      })
      .finally(() => setBusy(false));
  };

  const handleNotificationToggle = async (key: keyof UserNotificationSettingsDto, val: boolean) => {
    await s.run(async () => {
      await request('users/me/notification-settings', 'PATCH', { [key]: val });
      await notifRemote.reload();
    });
  };

  const handleAdultConfirm = async (confirmed: boolean) => {
    await s.run(async () => {
      await request('auth/adult-confirm', 'POST', { adultConfirmed: confirmed });
      await profileRemote.reload();
      s.notice(confirmed ? 'Возраст 18+ подтверждён' : 'Возраст обновлён');
    });
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    await s.run(async () => {
      if (smsSent) {
        await request('auth/change-phone/confirm', 'POST', { phone: newPhone, code: smsCode });
        setChangePhoneModal(false);
        setSmsSent(false);
        setNewPhone('');
        setSmsCode('');
        s.notice('Номер телефона успешно изменён');
        await profileRemote.reload();
      } else {
        await request('auth/change-phone', 'POST', { phone: newPhone, method: 'sms' });
        setSmsSent(true);
      }
    });
  };

  return (
    <div className="account-section settings-page">
      <div className="section-header">
        <h1>Настройки профиля</h1>
      </div>

      <RemoteState r={profileRemote}>
        {profile && (
          <form className="panel stack settings-form" onSubmit={handleProfileSubmit}>
            <h2>Личные данные</h2>
            <div className="form-grid">
              <label>
                Имя
                <input name="firstName" type="text" defaultValue={profile.firstName || ''} />
              </label>

              <label>
                Фамилия
                <input name="lastName" type="text" defaultValue={profile.lastName || ''} />
              </label>

              <label>
                Электронная почта
                <input name="email" type="email" defaultValue={profile.email || ''} />
              </label>

              <label>
                Дата рождения
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={profile.birthDate?.slice(0, 10) || ''}
                />
              </label>
            </div>

            <div className="current-phone-row">
              <div>
                <strong>Привязанный номер:</strong> {profile.phone}
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setChangePhoneModal(true);
                  setSmsSent(false);
                  setNewPhone('');
                  setSmsCode('');
                }}
              >
                Изменить номер телефона
              </button>
            </div>

            <button className="primary" disabled={busy} type="submit">
              {busy ? 'Сохраняем…' : 'Сохранить изменения'}
            </button>
          </form>
        )}

        <div className="panel stack settings-block">
          <h2>Уведомления</h2>
          <RemoteState r={notifRemote}>
            {notifSettings && (
              <div className="checkboxes-stack">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!notifSettings.ordersEnabled}
                    onChange={(e) => handleNotificationToggle('ordersEnabled', e.target.checked)}
                  />
                  <span>О статусах моих заказов</span>
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!notifSettings.promoEnabled}
                    onChange={(e) => handleNotificationToggle('promoEnabled', e.target.checked)}
                  />
                  <span>О персональных скидках и акциях</span>
                </label>

                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!notifSettings.emailEnabled}
                    onChange={(e) => handleNotificationToggle('emailEnabled', e.target.checked)}
                  />
                  <span>По электронной почте</span>
                </label>
              </div>
            )}
          </RemoteState>
        </div>

        <div className="panel stack settings-block">
          <h2>Возрастные ограничения</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={!!profile?.adultConfirmed}
              onChange={(e) => handleAdultConfirm(e.target.checked)}
            />
            <span>Мне исполнилось 18 лет (доступ к категории 18+)</span>
          </label>
        </div>

        <div className="panel danger-zone">
          <h3>Удаление данных</h3>
          <p className="muted">
            Вы можете запросить полное удаление аккаунта и связанных персональных данных.
          </p>
          <button
            className="text-button danger"
            type="button"
            onClick={() => setDangerModal(true)}
          >
            Удалить аккаунт
          </button>
        </div>
      </RemoteState>

      {dangerModal && (
        <Modal title="Удалить аккаунт?" onClose={() => setDangerModal(false)}>
          <div className="stack">
            <p>
              Это действие необратимо удалит ваш профиль, скидки и историю заказов. Для обычного
              выхода используйте кнопку «Выйти из аккаунта».
            </p>
            <button
              className="primary danger-btn"
              type="button"
              onClick={() =>
                s.run(async () => {
                  await request('auth/account', 'DELETE');
                  await s.refresh();
                  setDangerModal(false);
                  router.push('/');
                  router.refresh();
                })
              }
            >
              Подтверждаю, удалить мой аккаунт
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setDangerModal(false)}
            >
              Отмена
            </button>
          </div>
        </Modal>
      )}

      {changePhoneModal && (
        <Modal title="Изменить номер телефона" onClose={() => setChangePhoneModal(false)}>
          <form className="stack" onSubmit={handlePhoneSubmit}>
            {!smsSent ? (
              <label>
                Новый номер телефона
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  placeholder="+7 900 000-00-00"
                />
              </label>
            ) : (
              <label>
                Код подтверждения из SMS
                <input
                  value={smsCode}
                  inputMode="numeric"
                  onChange={(e) => setSmsCode(e.target.value)}
                  required
                  placeholder="000000"
                />
              </label>
            )}
            {phoneError && <ErrorMessage message={phoneError} />}
            <button className="primary" type="submit">
              {smsSent ? 'Подтвердить новый номер' : 'Получить код'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

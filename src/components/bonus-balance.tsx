'use client';

import { useShop } from './shop-context';

export function BonusBalance() {
  const s = useShop();
  const balance = s.profile.data?.bonusBalance;
  if (!s.authenticated) return <>Войдите</>;
  if (typeof balance === 'number') return <>{Math.trunc(balance).toLocaleString('ru-RU')}</>;
  if (s.profile.error) return <button type="button" className="text-button" onClick={event => { event.stopPropagation(); void s.profile.reload(); }}>Не удалось загрузить бонусы. Повторить</button>;
  return <span role="status">Загружаем…</span>;
}

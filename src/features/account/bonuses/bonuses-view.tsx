'use client';

import Link from 'next/link';
import { list, BonusTransactionDto } from '@/lib/types';
import { LoyaltyCard } from './loyalty-card';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function BonusesView() {
  const remote = useRemote<BonusTransactionDto[]>('bonuses?perPage=50');
  const transactions = list<BonusTransactionDto>(remote.data);

  return (
    <div className="account-section">
      <div className="section-header">
        <h1>Мои бонусы</h1>
      </div>

      <LoyaltyCard />

      <div className="bonuses-history panel">
        <h2>История операций</h2>
        <RemoteState r={remote}>
          {transactions.length ? (
            <div className="transactions-list">
              {transactions.map((b) => (
                <div className="card-row" key={b.id}>
                  <div>
                    <strong>{b.description || b.type || 'Бонусная операция'}</strong>
                    <small className="muted">
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString('ru-RU') : ''}
                    </small>
                  </div>
                  <strong className={typeof b.amount === 'number' && b.amount > 0 ? 'accent' : ''}>
                    {typeof b.amount === 'number'
                      ? (b.amount > 0 ? '+' : '') + Math.trunc(b.amount).toLocaleString('ru-RU')
                      : '—'}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">История бонусов пока пуста. Совершайте покупки для начисления бонусов.</p>
          )}
        </RemoteState>
      </div>

      <div className="faq-prompt">
        <Link href="/faq" className="text-button">
          Как работает программа лояльности «Ласточка» →
        </Link>
      </div>
    </div>
  );
}

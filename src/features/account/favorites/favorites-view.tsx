'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { list, product, Product } from '@/lib/types';
import { request } from '@/lib/client';
import { useShop } from '@/components/shop-context';
import { Empty } from '@/components/ui';
import { ProductGrid } from '@/components/products';
import { useRemote, RemoteState } from '../hooks/use-remote';

export function FavoritesView() {
  const remote = useRemote<any>('favorites?perPage=24');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const s = useShop();

  useEffect(() => {
    if (remote.data) {
      setItems(list(remote.data));
      setHasMore(!!(remote.data as any)?.hasMore);
    }
  }, [remote.data]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await s.run(async () => {
      const nextPage = page + 1;
      const data = await request<any>(`favorites?perPage=24&page=${nextPage}`);
      setPage(nextPage);
      setItems((prev) => [...prev, ...list(data)]);
      setHasMore(!!data?.hasMore);
    });
    setLoadingMore(false);
  };

  const products: Product[] = items.map(product);

  return (
    <div className="account-section">
      <div className="section-header">
        <h1>Избранное</h1>
        {products.length > 0 && <span className="muted">{products.length} товаров</span>}
      </div>

      <RemoteState r={remote}>
        {products.length ? (
          <>
            <ProductGrid products={products} />
            {hasMore && (
              <div className="load-more-wrapper">
                <button
                  className="secondary"
                  onClick={loadMore}
                  disabled={loadingMore}
                  type="button"
                >
                  {loadingMore ? 'Загружаем…' : 'Показать ещё'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="favorites-empty-container">
            <div className="favorites-swallow-wrap">
              <img
                src="/shop/images/swallow-transparent-v2.webp"
                alt="Ласточка"
                className="favorites-swallow-img"
                width={190}
                height={190}
              />
              <div className="favorites-swallow-shadow" />
            </div>
            <p className="favorites-empty-text">Любимые товары отобразятся здесь</p>
          </div>
        )}
      </RemoteState>
    </div>
  );
}

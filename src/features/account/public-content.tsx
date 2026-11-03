'use client';

import Link from 'next/link';
import { list, unwrap } from '@/lib/types';
import { Photo, Empty } from '@/components/ui';
import { ProductGrid } from '@/components/products';
import { product } from '@/lib/types';
import { useShop } from '@/components/shop-context';
import { useRemote, RemoteState } from './hooks/use-remote';

type StoryDto = {
  id: number;
  title: string;
  thumbnailImage?: { path: string } | null;
  images?: Array<{ id?: number; path: string; type?: string; mimeType?: string }>;
  linkType?: string;
  linkProductId?: number | null;
  linkStoreId?: number | null;
  linkExternalUrl?: string | null;
  isQuickCategory?: boolean;
  expiresAt?: string;
  customCheckboxes?: Record<string, unknown>;
};

type PromotionDto = {
  id: number;
  title: string;
  slug?: string | null;
  description?: string | null;
  image?: { path: string } | null;
  store?: { id: number; name: string; description?: string | null };
  discountPercent?: number;
  startsAt?: string;
  endsAt?: string;
  productsCount?: number;
};

export function PublicContent({ type, id }: { type: string; id?: string }) {
  const shop = useShop();
  const remote = useRemote<any>(type + (id ? '/' + id : ''));
  const story = type === 'stories' ? unwrap<StoryDto>(remote.data) : null;
  const promotion = type === 'promotions' ? unwrap<PromotionDto>(remote.data) : null;
  const promotionProducts = useRemote<any>(
    type === 'promotions' && id ? `promotions/${id}/products?perPage=100&storeId=${shop.storeId}` : null,
  );
  const items = type === 'stories' ? list<StoryDto>(remote.data) : list<PromotionDto>(remote.data);

  const title = type === 'stories' ? 'Истории' : 'Акции и специальные предложения';

  return (
    <div className="account-section public-content-page">
      <div className="section-header">
        <h1>{title}</h1>
        {id && (
          <Link href={`/${type}`} className="text-button">
            ← Ко всем {type === 'stories' ? 'историям' : 'акциям'}
          </Link>
        )}
      </div>

      <RemoteState r={remote}>
        {id ? (
          story ? (
            <article className="reading panel single-story">
              <h2>{story.title}</h2>
              {((story.images?.length
                ? story.images
                : story.thumbnailImage
                  ? [{ path: story.thumbnailImage.path }]
                  : []) as NonNullable<StoryDto['images']>).map(
                (image, index) => {
                  const isVideo = image.type === 'video' || image.mimeType?.startsWith('video/');
                  return isVideo ? (
                    <div className="story-video-wrapper" key={image.id || image.path}>
                      <video controls src={image.path} className="story-video" />
                    </div>
                  ) : (
                    <div className="story-photo-wrapper" key={image.id || image.path}>
                      <Photo src={image.path} alt={`${story.title} ${index + 1}`} />
                    </div>
                  );
                },
              )}
            </article>
          ) : promotion ? (
            <>
              <article className="reading panel single-story">
                <h2>{promotion.title}</h2>
                {promotion.image?.path && (
                  <div className="story-photo-wrapper">
                    <Photo src={promotion.image.path} alt={promotion.title} />
                  </div>
                )}
                {promotion.description && <p>{promotion.description}</p>}
                {promotion.discountPercent ? <p>Скидка {promotion.discountPercent}%</p> : null}
                {promotion.store?.name && <p>{promotion.store.name}</p>}
              </article>
              <RemoteState r={promotionProducts}>
                {list<any>(promotionProducts.data).length ? (
                  <ProductGrid products={list<any>(promotionProducts.data).map(product)} />
                ) : (
                  <Empty title="В акции пока нет доступных товаров" />
                )}
              </RemoteState>
            </>
          ) : (
            <Empty title={type === 'stories' ? 'История не найдена' : 'Акция не найдена'} />
          )
        ) : items.length ? (
          <div className="category-tiles content-tiles">
            {items.map((item) => (
              <Link href={`/${type}/${item.id}`} key={item.id} className="category-tile content-tile">
                <Photo
                  src={type === 'stories'
                    ? (item as StoryDto).thumbnailImage?.path || (item as StoryDto).images?.[0]?.path
                    : (item as PromotionDto).image?.path}
                  alt={item.title}
                />
                <strong>{item.title}</strong>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title={type === 'stories' ? 'Историй пока нет' : 'Пока нет активных акций'} />
        )}
      </RemoteState>
    </div>
  );
}

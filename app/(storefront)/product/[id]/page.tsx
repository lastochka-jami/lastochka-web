import type { Metadata } from 'next';
import { Catalog } from '@/features/storefront';
import { DirectProductDialog } from '@/components/product-dialog-navigation';
import { api, selectedStore } from '@/lib/upstream';
import { unwrap, Product, product } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const store = await selectedStore();
    const data = unwrap<any>(await api(`products/${encodeURIComponent(id)}?storeId=${store}`));
    if (data?.title) {
      const p = product(data);
      return {
        title: p.title,
        description:
          p.description ||
          `Купить ${p.title} по цене ${p.price} ₽ в онлайн-магазине «Ласточка Джами». Быстрая доставка и гарантия качества.`,
        openGraph: {
          title: `${p.title} · Ласточка Джами`,
          description:
            p.description ||
            `Свежие продукты: ${p.title} всего за ${p.price} ₽. Заказывайте с доставкой прямо сейчас!`,
          images: p.preview ? [{ url: p.preview }] : undefined,
          type: 'website',
        },
      };
    }
  } catch {
    // Fallback
  }

  return {
    title: 'Товар',
  };
}

export const revalidate = 60;

import { notFound } from 'next/navigation';

export default async function ProductRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const store = await selectedStore();
    await api(`products/${encodeURIComponent(id)}?storeId=${store}`);
    return <><Catalog kind="catalog" params={{}} /><DirectProductDialog id={Number(id)} /></>;
  } catch (err: any) {
    if (err?.status === 404 || err?.statusCode === 404) {
      notFound();
    }
    throw err;
  }
}


import type { BannerDto } from './types';

export function bannerHref(banner: BannerDto): string | undefined {
  if (banner.linkType === 'product' && banner.linkProductId) {
    return `/product/${banner.linkProductId}`;
  }
  if (banner.linkType === 'category' && banner.linkCategoryId) {
    return `/category/${banner.linkCategoryId}`;
  }
  return undefined;
}

export function catalogPageHref(query: URLSearchParams, page: number, sub?: string): string {
  const next = new URLSearchParams(query);
  next.set('page', String(page));
  if (sub) next.set('sub', sub);
  return '?' + next.toString();
}

import type { BannerDto } from './types';
import { imageSource } from './storefront-media';

function validTargetId(value: unknown): value is string | number {
  return /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value));
}

/** Validate on the server before rendering links; duplicate targets share a lookup. */
export async function visibleBanners(
  banners: BannerDto[],
  productExists: (id: string) => Promise<boolean>,
): Promise<BannerDto[]> {
  const candidates = banners.filter((banner) => imageSource(banner.image?.path) &&
    (banner.linkType === 'none' || !banner.linkType || !!bannerHref(banner)));
  const targets = [...new Set(candidates
    .filter((banner) => banner.linkType === 'product')
    .map((banner) => String(banner.linkProductId)))];
  const availability = new Map(await Promise.all(targets.map(async (id) => [id, await productExists(id)] as const)));
  return candidates.filter((banner) => banner.linkType !== 'product' || availability.get(String(banner.linkProductId)));
}

export function bannerHref(banner: BannerDto): string | undefined {
  if (banner.linkType === 'product' && validTargetId(banner.linkProductId)) {
    return `/product/${banner.linkProductId}`;
  }
  if (banner.linkType === 'category' && validTargetId(banner.linkCategoryId)) {
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

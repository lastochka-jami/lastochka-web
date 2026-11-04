import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerHref, catalogPageHref } from '../src/lib/storefront-links';

test('banner links follow the backend link type and target id', () => {
  assert.equal(bannerHref({ id: 1, title: 'Product', linkType: 'product', linkProductId: 42 }), '/product/42');
  assert.equal(bannerHref({ id: 2, title: 'Category', linkType: 'category', linkCategoryId: 7 }), '/category/7');
  assert.equal(bannerHref({ id: 3, title: 'No link', linkType: 'none', linkProductId: 42 }), undefined);
});

test('category pagination keeps the chosen subsection and filters', () => {
  const url = new URL(catalogPageHref(new URLSearchParams('priceMin=10&perPage=24&page=1'),2,'soup'), 'https://example.test/category/food');
  assert.equal(url.searchParams.get('sub'),'soup');
  assert.equal(url.searchParams.get('page'),'2');
  assert.equal(url.searchParams.get('priceMin'),'10');
});

test('banner targets reject malformed, zero and unsafe ids', () => {
  for (const target of [0, -1, '', '42?storeId=3', 'food/../../cart', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(bannerHref({ id: 1, title: 'Invalid product', linkType: 'product', linkProductId: target }), undefined);
    assert.equal(bannerHref({ id: 1, title: 'Invalid category', linkType: 'category', linkCategoryId: target }), undefined);
  }
});

test('banner boundary removes unavailable products and invalid media, deduplicates target lookups and keeps order', async () => {
  const { visibleBanners } = await import('../src/lib/storefront-links');
  const image = { path: 'https://example.test/banner.webp' };
  const checked: string[] = [];
  const banners = await visibleBanners([
    { id: 1, title: 'Expired target', image, linkType: 'product', linkProductId: 3244 },
    { id: 2, title: 'Available', image, linkType: 'product', linkProductId: 42 },
    { id: 3, title: 'Duplicate target', image, linkType: 'product', linkProductId: '42' },
    { id: 4, title: 'Missing image', linkType: 'product', linkProductId: 77 },
    { id: 5, title: 'Malformed target', image, linkType: 'product', linkProductId: '../cart' },
    { id: 6, title: 'Informational banner', image, linkType: 'none' },
    { id: 7, title: 'Category', image, linkType: 'category', linkCategoryId: 7 },
    { id: 8, title: 'Invalid image', image: { path: 'javascript:alert(1)' }, linkType: 'none' },
  ], async (id) => { checked.push(id); return id !== '3244'; });
  assert.deepEqual(banners.map((banner) => banner.id), [2, 3, 6, 7]);
  assert.deepEqual(checked, ['3244', '42']);
});

test('banner boundary does not convert upstream outages into a definitive missing product', async () => {
  const { visibleBanners } = await import('../src/lib/storefront-links');
  await assert.rejects(visibleBanners([
    { id: 1, title: 'Banner', image: { path: '/banner.webp' }, linkType: 'product', linkProductId: 42 },
  ], async () => { throw new Error('Temporary outage'); }), /Temporary outage/);
});

test('photo candidates normalize invalid sources and retain fallback order without duplicates', async () => {
  const { imageCandidates } = await import('../src/lib/storefront-media');
  assert.deepEqual(imageCandidates(' https://example.test/first.webp ', [
    'https://example.test/first.webp', '', 'not an image URL', 'javascript:alert(1)',
    '//example.test/image.webp', '/images/fallback.webp', 'https://example.test/last.webp',
  ]), ['https://example.test/first.webp', '/images/fallback.webp', 'https://example.test/last.webp']);
  assert.deepEqual(imageCandidates(undefined), []);
});

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

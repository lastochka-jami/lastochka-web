import { test, expect, type Page } from '@playwright/test';

async function authenticatedSession(page: Page) {
  let sessions = 0;
  await page.route('**/api/shop/**', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/session', route => {
    sessions++;
    return route.fulfill({ json: { authenticated: true, csrf: 'test', storeId: 2, checkoutEnabled: false, publicOrigin: 'http://127.0.0.1:3011' } });
  });
  await page.route('**/api/shop/cart?*', route => route.fulfill({ json: { data: { storeGroups: [] } } }));
  return () => sessions;
}

test('cart mutation refreshes cart without refetching session', async ({ page }) => {
  const sessions = await authenticatedSession(page);
  let writes = 0, carts = 0;
  await page.route('**/api/shop/cart?*', route => { carts++; return route.fulfill({ json: { data: { storeGroups: [] } } }); });
  await page.route('**/api/shop/cart/items', route => { writes++; return route.fulfill({ json: {} }); });
  await page.goto('/shop/product/10');
  await expect.poll(sessions).toBe(1);
  await expect.poll(() => carts).toBe(1);
  await page.locator('.product-detail .detail-buy .add-button').click();
  await expect.poll(() => writes).toBe(1);
  await expect.poll(() => carts).toBe(2);
  expect(sessions()).toBe(1);
});

test('reviews keep loaded content throughout a failed background refresh', async ({ page }) => {
  await authenticatedSession(page);
  let reads = 0;
  let release!: () => void;
  await page.route('**/api/shop/products/10/reviews', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: {} });
    reads++;
    if (reads === 1) return route.fulfill({ json: { data: [{ id: 1, rating: 5, text: 'Сохранённый отзыв' }] } });
    await new Promise<void>(resolve => { release = resolve; });
    return route.fulfill({ status: 500, json: { message: 'Тестовая ошибка обновления' } });
  });
  await page.goto('/shop/product/10');
  const review = page.getByText('Сохранённый отзыв');
  await expect(review).toBeVisible();
  await page.getByRole('button', { name: 'Оставить отзыв' }).click();
  await page.getByLabel('Ваши впечатления').fill('Новый отзыв');
  await page.getByRole('button', { name: 'Опубликовать отзыв' }).click();
  await expect.poll(() => reads).toBe(2);
  await expect(review).toBeVisible();
  release();
  await expect(page.getByText('Тестовая ошибка обновления').first()).toBeVisible();
  await expect(review).toBeVisible();
});

test('slow recommendations do not block product content or move the reserved region', async ({ page }) => {
  await page.route('**/api/shop/products/31/reviews', route => route.fulfill({ json: { data: [] } }));
  await page.setExtraHTTPHeaders({ 'cache-control': 'no-cache' });
  await page.goto('/shop/product/31', { waitUntil: 'commit' });
  await expect(page.locator('.product-detail h1')).toBeVisible();
  const slot = page.locator('.product-recommendations-slot');
  await expect(page.getByText('Пока нет отзывов.', { exact: false })).toBeVisible();
  const before = await slot.boundingBox();
  await expect(slot.getByRole('heading', { name: 'Вам может понравиться' })).toBeAttached();
  const after = await slot.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.y).toBe(before?.y);
});

test('streamed filters retain the selected catalog price', async ({ page }) => {
  await page.goto('/shop/search?query=food&priceMin=10');
  await expect(page.locator('.product-card').first()).toBeVisible();
  const filters = page.getByRole('button', { name: /Фильтры/ });
  await expect(filters).toBeEnabled();
  await filters.click();
  await expect(page.getByRole('dialog').getByLabel('Цена от', { exact: true })).toHaveValue('10');
});

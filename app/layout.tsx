import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { ShopProvider } from '@/components/shop-context';
import { Header } from '@/components/header';
import { HomeBrandLink } from '@/components/home-brand-link';
import { publicApi, selectedStore } from '@/lib/upstream';
import { unwrap, Store } from '@/lib/types';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#e20a25',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'Ласточка Джами — доставка',
    template: '%s · Ласточка Джами',
  },
  description:
    'Продукты, свежая выпечка и готовые блюда. Каталог, быстрая доставка и самовывоз из Ласточки Джами.',
  applicationName: 'Ласточка Джами',
  icons: {
    icon: [
      { url: '/shop/favicon-mark-v3.ico', sizes: 'any' },
      { url: '/shop/favicon-mark-32-v3.png', sizes: '32x32', type: 'image/png' },
      { url: '/shop/favicon-mark-16-v3.png', sizes: '16x16', type: 'image/png' },
      { url: '/shop/brand-icon-192-v2.png', sizes: '192x192', type: 'image/png' },
      { url: '/shop/brand-icon-512-v2.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/shop/apple-touch-icon-v2.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/shop/favicon-mark-v3.ico'],
  },
  manifest: '/shop/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Ласточка Джами',
    title: 'Ласточка Джами — доставка',
    description:
      'Продукты, свежая выпечка и готовые блюда. Каталог, быстрая доставка и самовывоз из Ласточки Джами.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ласточка Джами — доставка',
    description: 'Продукты, выпечка и готовые блюда с доставкой и самовывозом.',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let store: Store | null = null;
  try {
    const storeId = await selectedStore();
    store = unwrap<Store>(await publicApi(`stores/${storeId}`));
  } catch {
    // Graceful fallback to default null
  }

  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main">
          Перейти к содержимому
        </a>
        <ShopProvider>
          <Header store={store} />
          <main id="main" className="container">
            {children}
          </main>
          <footer className="container footer">
            <HomeBrandLink className="footer-brand" imageSize={30}>
              <span>Ласточка Джами</span>
            </HomeBrandLink>
            <span>Всё любимое — рядом</span>
            <Link href="/faq">Вопросы и ответы</Link>
            <Link href="/info">Информация и контакты</Link>
          </footer>
        </ShopProvider>
      </body>
    </html>
  );
}

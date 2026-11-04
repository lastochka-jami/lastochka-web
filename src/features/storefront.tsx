import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, MapPin, ChevronRight, LayoutGrid, FolderOpen } from 'lucide-react';
import { api, publicApi, selectedStore, ApiError } from '@/lib/upstream';
import {
  list,
  unwrap,
  product,
  Category,
  categoryMedia,
  ProductGroupDto,
  BannerDto,
  Product,
  getCategoryGroupColor,
} from '@/lib/types';
import { content } from '@/config/content';
import { Photo, Empty } from '@/components/ui';
import { ProductGrid, ProductDetail, ProductCarousel } from '@/components/products';
import { Filters } from '@/components/filters';
import { LoyaltyCard } from './account/bonuses/loyalty-card';
import { Reviews } from './account/reviews/reviews-view';
import { InteractiveCategorySection } from '@/components/interactive-category-section';
import { CategoryFallback } from '@/components/category-fallback';
import { LocationTrigger } from '@/components/location-sheet';
import { bannerHref, catalogPageHref, visibleBanners } from '@/lib/storefront-links';

export { getCategoryGroupColor };

type StorefrontStoryDto = {
  id: number;
  title: string;
  thumbnailImage?: { path: string } | null;
  images?: Array<{ path: string; type?: string; mimeType?: string }>;
};

export function SectionHeading({
  title,
  href,
  subtitle,
}: {
  title: string;
  href?: string;
  subtitle?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {subtitle && <p className="eyebrow">{subtitle}</p>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href}>
          Смотреть всё <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}

async function HomeStories() {
  const stories = await publicApi('stories').then(list<StorefrontStoryDto>).catch(() => []);
  if (!stories.length) return null;
  return (
    <div className="stories">
      {stories.map((story) => (
        <Link href={'/stories/' + story.id} key={story.id}>
          <Photo
            src={story.thumbnailImage?.path || story.images?.[0]?.path}
            alt={story.title}
            width={82}
            height={82}
            sizes="82px"
          />
          <span>{story.title}</span>
        </Link>
      ))}
    </div>
  );
}

async function HomeBanners({ store }: { store: number }) {
  const banners = await publicApi(`stores/${store}/banners`)
    .then(list<BannerDto>)
    .then((items) => visibleBanners(items, async (id) => {
      try {
        await publicApi(`products/${id}?storeId=${store}`);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return false;
        throw error;
      }
    }))
    .catch(() => []);
  if (!banners.length) return null;
  return (
    <section className="home-banners-section" aria-label="Акции магазина">
      <div className="home-banners">
        {banners.map((banner, index) => {
          const href = bannerHref(banner);
          const tile = (
            <>
              <Photo
                src={banner.image?.path}
                alt={banner.title}
                sizes="(max-width: 767px) calc(100vw - 28px), (max-width: 1399px) calc((100vw - 64px) / 2), 648px"
                eager={index === 0}
              />
              <strong>{banner.title}</strong>
            </>
          );
          return href ? (
            <Link href={href} className="home-banner" key={banner.id}>
              {tile}
            </Link>
          ) : (
            <div className="home-banner" key={banner.id}>{tile}</div>
          );
        })}
      </div>
    </section>
  );
}

async function HomeCategories({ categories }: { categories: Promise<HomeCategory[]> }) {
  const roots = await categories;
  const children = roots.slice(0, 4).flatMap((category) => (category.children || []).slice(0, 2));
  const showcase = children.length >= 3 ? children.slice(0, 6) : roots.slice(0, 6);
  return (
    <section className="home-showcase-section">
      {showcase.length ? (
        <>
          <SectionHeading title="Популярные категории" href="/catalog" />
          <CategoryTiles categories={showcase} />
        </>
      ) : <p className="muted">Категории пока не добавлены.</p>}
    </section>
  );
}

async function HomeCollections({ groups }: { groups: Promise<ProductGroupDto[]> }) {
  const recommended = (await groups).filter((group) => group.is_recommended);
  if (!recommended.length) return null;
  return (
    <section className="home-collections-section">
      <SectionHeading title={content.home.titles.collections} />
      <div className="collections">
        {recommended.map((group, index) => (
          <Link key={group.id} href={'/collection/' + group.slug} className={`collection-tile tone-${index % 5}`}>
            <Photo src={group.image?.path} alt="" sizes="(max-width: 767px) calc((100vw - 38px) / 2), (max-width: 1023px) calc((100vw - 68px) / 3), 220px" />
            <strong>{group.title}</strong>
            <span className="tile-arrow"><ArrowRight size={18} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function HomeFeatured({ store, groups }: { store: number; groups: Promise<ProductGroupDto[]> }) {
  const allGroups = await groups;
  const featured = allGroups.find((group) => group.slug === 'firmennye-bliuda') ||
    allGroups.find((group) => !group.is_recommended && (group.productsCount || 0) > 0);
  if (!featured) return null;
  const products = await publicApi(`product-groups/${featured.id}/products?storeId=${store}&perPage=8`)
    .then(list<Product>).then((items) => items.map(product)).catch(() => []);
  if (!products.length) return null;
  return (
    <section>
      <SectionHeading title={featured.title} href={'/collection/' + featured.slug} subtitle="Приготовлено с заботой" />
      <ProductCarousel products={products} />
    </section>
  );
}

export async function Home() {
  const store = await selectedStore();
  const groups = publicApi(`stores/${store}/product-groups`).then(list<ProductGroupDto>).catch(() => []);
  const categories = publicApi(`stores/${store}/categories?includeChildren=true&perPage=100`).then(list<HomeCategory>).catch(() => []);

  return (
    <>
      <section className="welcome">
        <div className="welcome-text">
          <p className="eyebrow">{content.brand}</p>
          <h1>{content.tagline}</h1>
          <p>Продукты для любимых блюд.<br className="mobile-break" /> И маленьких повседневных радостей.</p>
          <LocationTrigger className="address-cta" initialTab="delivery">
            <MapPin size={18} /> Указать адрес доставки <ChevronRight size={16} />
          </LocationTrigger>
        </div>
        <LoyaltyCard compact />
      </section>
      <div className="home-sheet">
        <Suspense fallback={null}><HomeStories /></Suspense>
        <Suspense fallback={null}><HomeBanners store={store} /></Suspense>
        <Suspense fallback={
          <section className="home-showcase-section category-loading" aria-busy="true">
            <SectionHeading title="Популярные категории" href="/catalog" />
            <div className="category-tiles" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <span className="category-tile" key={index} />)}
            </div>
          </section>
        }>
          <HomeCategories categories={categories} />
        </Suspense>
        <Suspense fallback={null}><HomeCollections groups={groups} /></Suspense>
        <Suspense fallback={null}><HomeFeatured store={store} groups={groups} /></Suspense>
        <section className="catalog-hint-section">
          <div className="catalog-hint-card">
            <div className="catalog-hint-info">
              <div className="catalog-hint-badge"><LayoutGrid size={24} /></div>
              <div><h3>Каталог всех товаров</h3><p>Готовая кулинария, свежая выпечка, фермерские продукты и напитки</p></div>
            </div>
            <Link href="/catalog" className="catalog-hint-button">Открыть каталог <ArrowRight size={18} /></Link>
          </div>
        </section>
      </div>
    </>
  );
}

export function CategoryTiles({
  categories,
  backgroundColor,
}: {
  categories: Category[];
  backgroundColor?: string;
}) {
  return (
    <div className="category-tiles">
      {categories.map((c, i) => {
        const media = categoryMedia(c);
        const imageSrc = media.foreground || media.background;
        const tileBg = backgroundColor || getCategoryGroupColor(c);
        return (
          <Link
            className="category-tile"
            style={{ backgroundColor: tileBg }}
            href={'/category/' + c.slug}
            key={c.id}
          >
            <span className="category-tile-title">{c.name}</span>
            {imageSrc ? (
              <div className="category-tile-image-wrapper">
                <Photo
                  src={imageSrc}
                  alt={c.name}
                  className="category-tile-image"
                  width={140}
                  height={140}
                  sizes="(max-width: 767px) calc((100vw - 44px) * 0.1933), (max-width: 1023px) calc((100vw - 70px) * 0.145), (max-width: 1399px) calc((100vw - 124px) * 0.0967), 126px"
                />
              </div>
            ) : (
              <CategoryFallback category={c} />
            )}
          </Link>
        );
      })}
    </div>
  );
}

type HomeCategory = Category & { children?: HomeCategory[] };

function findCategoryPathInTree(
  roots: HomeCategory[],
  target: string,
): Category[] | null {
  function visit(nodes: HomeCategory[], parents: Category[]): Category[] | null {
    for (const node of nodes) {
      const path = [...parents, node];
      if (String(node.id) === target || node.slug === target) return path;
      const nested = visit(node.children || [], path);
      if (nested) return nested;
    }
    return null;
  }
  return visit(roots, []);
}

async function CatalogCategorySection({ store, category }: { store: number; category: HomeCategory }) {
  const groupBg = getCategoryGroupColor(category);
  const children = category.children || [];

  const tilesToRender = children.length ? children : [category];

  if (!tilesToRender.length) {
    return null;
  }

  return (
    <InteractiveCategorySection
      store={store}
      category={category}
      subcategories={tilesToRender}
      groupBg={groupBg}
    />
  );
}

function RootCatalog({ store, categories }: { store: number; categories: HomeCategory[] }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="catalog-sections">
        <p className="muted">Каталог пока пуст.</p>
      </div>
    );
  }

  return (
    <div className="catalog-sections">
      {categories.map((category) => (
        <Suspense
          key={category.id}
          fallback={
            <section className="catalog-category-section category-loading">
              <div className="section-heading">
                <h2>{category.name}</h2>
              </div>
              <div className="category-tiles" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="category-tile-skeleton" />
                ))}
              </div>
            </section>
          }
        >
          <CatalogCategorySection store={store} category={category} />
        </Suspense>
      ))}
    </div>
  );
}

function queryString(params: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (
      typeof v === 'string' &&
      (/^(page|query|sort|priceMin|priceMax|onlyDiscounted|sugarFree|categoryId|brandId)$/.test(k) ||
        /^filter\[[a-zA-Z0-9_-]+\]$/.test(k))
    ) {
      q.set(k, v);
    }
  }
  q.set('perPage', String(content.pageSize));
  return q;
}

export async function Catalog({
  kind,
  id,
  params,
}: {
  kind: string;
  id?: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const store = await selectedStore();
  const q = queryString(params);
  let title = 'Каталог';
  let data: any = { data: [] };
  let children: Category[] = [];
  let filters: any = null;
  let path: Category[] = [];
  let activeChild: Category | null = null;

  const needsCategoryTree =
    (kind === 'catalog' && !id) || kind === 'category';
  const needsSearchCategories =
    kind === 'search' && (typeof params.query !== 'string' || params.query.trim().length < 2);
  const categories = needsCategoryTree || needsSearchCategories
    ? list<HomeCategory>(
        await publicApi(
          `stores/${store}/categories${needsCategoryTree ? '?includeChildren=true&perPage=100' : ''}`,
        ),
      )
    : [];

  if (kind === 'catalog' && !id) {
    return (
      <>
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <span>Каталог</span>
        </div>
        <div className="page-heading">
          <h1>Каталог</h1>
        </div>
        <RootCatalog store={store} categories={categories} />
      </>
    );
  }

  if (kind === 'search') {
    title = params.query ? `Результаты поиска «${params.query}»` : 'Найдётся всё, что нужно';
    if (typeof params.query !== 'string' || params.query.trim().length < 2) {
      return (
        <>
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p className="muted">Введите название товара в строке поиска выше или выберите нужный раздел</p>
            </div>
          </div>
          <CategoryTiles categories={categories} />
        </>
      );
    }
    [data, filters] = await Promise.all([
      api(`search/stores/${store}/products?${q}`),
      api(`search/stores/${store}/filters?${q}`),
    ]);
  } else if (kind === 'collection') {
    data = await api(
      `stores/${store}/product-groups/slug/${encodeURIComponent(id || '')}/products?${q}`,
    );
    title = data.group?.title || title;
  } else {
    // Category page
    path = findCategoryPathInTree(categories, id || '') || [];

    const current = path.at(-1);
    if (!current) {
      throw new ApiError(404, { message: 'Категория не найдена' });
    }

    title = current.name;
    children = (current as HomeCategory).children || [];

    // Resolve active subcategory if subcategories exist:
    if (children.length > 0) {
      const subParam = typeof params.sub === 'string' ? params.sub : undefined;
      activeChild = subParam
        ? children.find((c) => c.slug === subParam || String(c.id) === subParam) || null
        : null;
    }

    // Always fetch products! If subcategory is active, fetch its products; otherwise current category
    const targetCategoryId = activeChild ? activeChild.id : current.id;

    [data, filters] = await Promise.all([
      api(`stores/${store}/categories/${targetCategoryId}/products?${q}`),
      publicApi(`stores/${store}/categories/${targetCategoryId}/filters`),
    ]);
  }

  const products = list(data).map(product);
  const page = Math.max(1, Number(params.page) || 1);

  function pageLink(n: number) {
    return catalogPageHref(q, n, typeof params.sub === 'string' ? params.sub : undefined);
  }

  const currentCategory = path.at(-1);

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/catalog">Каталог</Link>
        {path.map((c) => (
          <span key={c.id} className="breadcrumb-part">
            <span>/</span>
            <Link href={'/category/' + c.slug}>{c.name}</Link>
          </span>
        ))}
        {activeChild && (
          <span className="breadcrumb-part">
            <span>/</span>
            <span>{activeChild.name}</span>
          </span>
        )}
      </div>

      <div className="page-heading">
        <div>
          <h1>{title}</h1>
        </div>
        <div className="page-heading-actions">
          {typeof data.total === 'number' && (
            <span className="muted total-count-badge">{data.total.toLocaleString('ru-RU')} товаров</span>
          )}
          <Filters filters={unwrap(filters)} />
        </div>
      </div>

      {/* Horizontal Pills (Chips) Bar for Subcategories - just like the mobile app! */}
      {children.length > 0 && currentCategory && (
        <div className="subcategory-pills-bar">
          <div className="subcategory-pills-scroll">
            <Link
              href={`/category/${currentCategory.slug}`}
              className={`subcategory-pill ${!activeChild ? 'active' : ''}`}
            >
              Все
            </Link>
            {children.map((child) => {
              const isActive =
                activeChild && (activeChild.id === child.id || activeChild.slug === child.slug);
              return (
                <Link
                  key={child.id}
                  href={`/category/${currentCategory.slug}?sub=${child.slug || child.id}`}
                  className={`subcategory-pill ${isActive ? 'active' : ''}`}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Catalog Layout with Desktop Sidebar and Dense Products Grid */}
      <div className="catalog-layout">
        {children.length > 0 && currentCategory && (
          <aside className="filters-desktop">
            <div className="sidebar-subcategories">
              <div className="sidebar-subcategories-header">
                <FolderOpen size={16} />
                <h4>Подразделы</h4>
              </div>
              <nav className="sidebar-subcategories-list">
                <Link
                  href={`/category/${currentCategory.slug}`}
                  className={`sidebar-subcategory-link ${!activeChild ? 'active' : ''}`}
                >
                  <span>Все товары</span>
                </Link>
                {children.map((child) => {
                  const isActive =
                    activeChild && (activeChild.id === child.id || activeChild.slug === child.slug);
                  return (
                    <Link
                      key={child.id}
                      href={`/category/${currentCategory.slug}?sub=${child.slug || child.id}`}
                      className={`sidebar-subcategory-link ${isActive ? 'active' : ''}`}
                    >
                      <span>{child.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}
        <div className="catalog-main">
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <Empty title="В этом разделе пока нет товаров">
              <p>Попробуйте выбрать другой подраздел или сбросить фильтры.</p>
            </Empty>
          )}

          <nav className="pagination" aria-label="Страницы каталога">
            {page > 1 && (
              <Link className="secondary" href={pageLink(page - 1)}>
                ← Назад
              </Link>
            )}
            <span>Страница {page}</span>
            {data.hasMore && (
              <Link className="primary" href={pageLink(page + 1)}>
                Далее →
              </Link>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}

export async function ProductPage({ id }: { id: string }) {
  const store = await selectedStore();
  const [detailData, similar, relatedGroups] = await Promise.all([
    api(`products/${encodeURIComponent(id)}?storeId=${store}`),
    publicApi(`products/${id}/similar?storeId=${store}&perPage=6`).then(list).catch(() => []),
    publicApi(`products/${id}/related?storeId=${store}&perPage=6`).then(list).catch(() => []),
  ]);
  const p = product(unwrap(detailData));

  const related = relatedGroups
    .flatMap((group) => (Array.isArray(group.products) ? group.products : [group]))
    .filter((v) => v?.title && v?.price != null);

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/catalog">Каталог</Link>
        {p.category && (
          <>
            <span>/</span>
            <Link href={'/category/' + (p.category.slug || p.category.id)}>
              {p.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span>{p.title}</span>
      </div>

      <ProductDetail p={p} stickyBuy />
      <Reviews productId={p.id} />

      {similar.length > 0 && (
        <section>
          <SectionHeading title="Вам может понравиться" />
          <ProductGrid products={similar.slice(0, 6).map(product)} />
        </section>
      )}

      {related.length > 0 && (
        <section>
          <SectionHeading title="Хорошо сочетается" />
          <ProductGrid products={related.slice(0, 6).map(product)} />
        </section>
      )}
    </>
  );
}

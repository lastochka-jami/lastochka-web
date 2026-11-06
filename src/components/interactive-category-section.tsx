import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Category, categoryMedia } from '@/lib/types';
import { CategoryFallback } from '@/components/category-fallback';

/**
 * Секция каталога с плитками подкатегорий.
 * Все плитки оформлены как прямые ссылки Next.js (<Link>) на страницу /category/[slug].
 * Раскрывающаяся шторка/аккордеон исключены для мгновенного перехода в раздел на всех устройствах.
 */
export function InteractiveCategorySection({
  store: _store,
  category,
  subcategories,
  groupBg,
}: {
  store?: number;
  category: Category;
  subcategories: Category[];
  groupBg: string;
}) {
  return (
    <section className="catalog-category-section" id={`cat-${category.slug}`}>
      <div className="section-heading">
        <h2>{category.name}</h2>
        <Link href={`/category/${category.slug}`} className="see-all-link">
          Смотреть всё <ArrowRight size={16} />
        </Link>
      </div>

      <div className="category-tiles">
        {subcategories.map((c) => {
          const media = categoryMedia(c);
          const imageSrc = media.foreground;

          return (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="category-tile"
              style={{ backgroundColor: groupBg }}
            >
              <strong className="category-tile-title">{c.name}</strong>
              {imageSrc ? (
                <div className="category-tile-image-wrapper">
                  <img
                    src={imageSrc}
                    alt=""
                    className="category-tile-image"
                    loading="lazy"
                    width={110}
                    height={110}
                  />
                </div>
              ) : (
                <CategoryFallback category={c} />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  FolderOpen,
  X,
  Flame,
  ArrowUp,
  ArrowDown,
  Tag,
  Sparkles,
} from 'lucide-react';

export interface SubcategoryItem {
  id: number;
  name: string;
  slug: string;
}

export interface SubcategoriesNavProps {
  items: SubcategoryItem[];
  activeId?: number | string;
  parentSlug: string;
}

const SORT_OPTIONS = [
  {
    id: 'popular',
    label: 'Сначала популярные',
    type: 'popular',
  },
  {
    id: 'price_asc',
    label: 'Сначала дешёвые',
    type: 'price_asc',
  },
  {
    id: 'price_desc',
    label: 'Сначала дорогие',
    type: 'price_desc',
  },
  {
    id: 'discount',
    label: 'Сначала со скидкой',
    type: 'discount',
  },
  {
    id: 'newest',
    label: 'Сначала новинки',
    type: 'newest',
  },
] as const;

export function Filters({
  filters,
  subcategories,
  loading = false,
}: {
  filters?: any;
  loading?: boolean;
  subcategories?: SubcategoriesNavProps;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();

  // Extract limits
  const filterList = Array.isArray(filters)
    ? filters
    : Array.isArray(filters?.filters)
    ? filters.filters
    : Array.isArray(filters?.attributes)
    ? filters.attributes
    : [];

  const priceFilter =
    filterList.find((f: any) => f?.code === 'price') ||
    (filters && typeof filters === 'object' && filters?.price);

  const minLimit = Math.max(0, Math.floor(Number(priceFilter?.min ?? 0)));
  const maxLimit = Math.max(
    minLimit + 10,
    Math.ceil(Number(priceFilter?.max ?? 5000)) || 5000,
  );

  // Active filter count
  const sortParam = params.get('sort');
  const hasActiveSort = sortParam && sortParam !== 'popular';
  const priceMinParam = params.get('priceMin');
  const hasActivePriceMin = priceMinParam && Number(priceMinParam) > minLimit;
  const priceMaxParam = params.get('priceMax');
  const hasActivePriceMax = priceMaxParam && Number(priceMaxParam) < maxLimit;
  const activeAttrCount = [...params.keys()].filter(
    (k) => k.startsWith('filter[') && params.get(k),
  ).length;

  const activeCount =
    (hasActiveSort ? 1 : 0) +
    (hasActivePriceMin ? 1 : 0) +
    (hasActivePriceMax ? 1 : 0) +
    activeAttrCount;

  return (
    <>
      {subcategories && subcategories.items.length > 0 && (
        <aside className="filters-desktop">
          <div className="sidebar-subcategories">
            <div className="sidebar-subcategories-header">
              <FolderOpen size={16} />
              <h4>Подразделы</h4>
            </div>
            <nav className="sidebar-subcategories-list">
              {subcategories.items.map((sub) => {
                const isActive =
                  String(subcategories.activeId) === String(sub.id) ||
                  subcategories.activeId === sub.slug;
                return (
                  <Link
                    key={sub.id}
                    href={`/category/${subcategories.parentSlug}?sub=${sub.slug || sub.id}`}
                    className={`sidebar-subcategory-link ${isActive ? 'active' : ''}`}
                  >
                    <span>{sub.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
      )}

      <button
        className={`filter-trigger-btn ${activeCount > 0 ? 'has-active' : ''}`}
        onClick={() => setOpen(true)}
        type="button"
        disabled={loading}
        aria-busy={loading}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersHorizontal size={17} />
        <span>Фильтры</span>
        {activeCount > 0 && (
          <span className="filter-count" aria-label={`Активных фильтров: ${activeCount}`}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <FilterModal
          filters={filters}
          minLimit={minLimit}
          maxLimit={maxLimit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FilterModal({
  filters,
  minLimit,
  maxLimit,
  onClose,
}: {
  filters?: any;
  minLimit: number;
  maxLimit: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();

  // Initial state from URL
  const initialSort = params.get('sort') || 'popular';
  const urlMin = params.get('priceMin') ? Number(params.get('priceMin')) : minLimit;
  const urlMax = params.get('priceMax') ? Number(params.get('priceMax')) : maxLimit;

  const [selectedSort, setSelectedSort] = useState<string>(initialSort);
  const [priceMin, setPriceMin] = useState<number>(
    Math.max(minLimit, Math.min(urlMin, maxLimit)),
  );
  const [priceMax, setPriceMax] = useState<number>(
    Math.min(maxLimit, Math.max(urlMax, minLimit)),
  );

  // Extra attributes (if backend provides any)
  const filterList = Array.isArray(filters)
    ? filters
    : Array.isArray(filters?.filters)
    ? filters.filters
    : Array.isArray(filters?.attributes)
    ? filters.attributes
    : [];
  const attributes = filterList.filter(
    (a: any) => a?.code && a.code !== 'price' && Array.isArray(a.values) && a.values.length > 0,
  );

  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    for (const attr of attributes) {
      const val = params.get(`filter[${attr.code}]`);
      if (val) res[attr.code] = val;
    }
    return res;
  });

  // Calculate percentages for the dual range track
  const rangeSpan = Math.max(1, maxLimit - minLimit);
  const minPercent = Math.min(
    100,
    Math.max(0, Math.round(((priceMin - minLimit) / rangeSpan) * 100)),
  );
  const maxPercent = Math.min(
    100,
    Math.max(0, Math.round(((priceMax - minLimit) / rangeSpan) * 100)),
  );

  // Dialog open & lock scroll
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) {
      el.showModal();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      if (el.open) el.close();
    };
  }, []);

  const hasChanges =
    selectedSort !== 'popular' ||
    priceMin > minLimit ||
    priceMax < maxLimit ||
    Object.values(selectedAttrs).some(Boolean);

  const handleReset = () => {
    setSelectedSort('popular');
    setPriceMin(minLimit);
    setPriceMax(maxLimit);
    setSelectedAttrs({});

    const p = new URLSearchParams();
    if (params.get('query')) p.set('query', params.get('query')!);
    if (params.get('sub')) p.set('sub', params.get('sub')!);

    router.push(path + (p.toString() ? '?' + p.toString() : ''));
    onClose();
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(params.toString());
    p.delete('page');

    // Remove existing filters
    for (const key of [...p.keys()]) {
      if (key.startsWith('filter[')) p.delete(key);
    }

    // Sort
    if (selectedSort && selectedSort !== 'popular') {
      p.set('sort', selectedSort);
    } else {
      p.delete('sort');
    }

    // Price
    if (priceMin > minLimit) {
      p.set('priceMin', String(priceMin));
    } else {
      p.delete('priceMin');
    }

    if (priceMax < maxLimit) {
      p.set('priceMax', String(priceMax));
    } else {
      p.delete('priceMax');
    }

    // Attributes
    for (const [code, val] of Object.entries(selectedAttrs)) {
      if (val) {
        p.set(`filter[${code}]`, val);
      }
    }

    router.push(path + (p.toString() ? '?' + p.toString() : ''));
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="filter-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="filter-dialog-heading"
    >
      <div className="filter-dialog-inner">
        {/* Mobile handle indicator */}
        <div className="filter-sheet-drag-handle" aria-hidden="true" />

        {/* Header */}
        <div className="filter-dialog-header">
          <h2 id="filter-dialog-heading" className="filter-dialog-title">
            Фильтры
          </h2>
          <div className="filter-dialog-header-actions">
            {hasChanges && (
              <button
                type="button"
                className="filter-reset-header-btn"
                onClick={handleReset}
              >
                Сбросить
              </button>
            )}
            <button
              type="button"
              className="filter-close-btn"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form className="filter-dialog-form" onSubmit={handleApply}>
          <div className="filter-dialog-scrollable">
            {/* 1. Sorting section */}
            <section className="filter-section">
              <h3 className="filter-section-title">Сортировка</h3>
              <div className="filter-sort-list" role="radiogroup" aria-label="Сортировка">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = selectedSort === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`filter-sort-card ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedSort(opt.id)}
                    >
                      <div className="filter-sort-card-left">
                        <div
                          className={`filter-sort-icon-wrap ${
                            opt.type === 'popular' && isSelected ? 'popular-active' : ''
                          }`}
                        >
                          {opt.type === 'popular' && (
                            <Flame
                              size={18}
                              className={isSelected ? 'text-white' : 'text-red'}
                              fill="currentColor"
                            />
                          )}
                          {opt.type === 'price_asc' && (
                            <ArrowUp size={18} className="text-dark" />
                          )}
                          {opt.type === 'price_desc' && (
                            <ArrowDown size={18} className="text-dark" />
                          )}
                          {opt.type === 'discount' && (
                            <Tag size={18} className="text-red" fill="rgba(229, 46, 46, 0.2)" />
                          )}
                          {opt.type === 'newest' && (
                            <Sparkles size={18} className="text-red" />
                          )}
                        </div>
                        <span className="filter-sort-card-label">{opt.label}</span>
                      </div>
                      <div
                        className={`filter-radio-indicator ${isSelected ? 'active' : ''}`}
                        aria-hidden="true"
                      >
                        {isSelected && <span className="filter-radio-dot" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Price section */}
            <section className="filter-section">
              <h3 className="filter-section-title">Цена</h3>

              {/* Price inputs: "от" and "до" */}
              <div className="filter-price-inputs-grid">
                <div className="filter-price-box">
                  <span className="filter-price-label">от</span>
                  <div className="filter-price-value-row">
                    <input
                      type="number"
                      min={minLimit}
                      max={priceMax}
                      value={priceMin}
                      onChange={(e) => {
                        const val = e.target.value === '' ? minLimit : Number(e.target.value);
                        if (!isNaN(val)) {
                          setPriceMin(Math.max(minLimit, Math.min(val, priceMax)));
                        }
                      }}
                      className="filter-price-number-input"
                      aria-label="Цена от"
                    />
                    <span className="filter-price-currency">₽</span>
                  </div>
                </div>

                <div className="filter-price-box">
                  <span className="filter-price-label">до</span>
                  <div className="filter-price-value-row">
                    <input
                      type="number"
                      min={priceMin}
                      max={maxLimit}
                      value={priceMax}
                      onChange={(e) => {
                        const val = e.target.value === '' ? maxLimit : Number(e.target.value);
                        if (!isNaN(val)) {
                          setPriceMax(Math.min(maxLimit, Math.max(val, priceMin)));
                        }
                      }}
                      className="filter-price-number-input"
                      aria-label="Цена до"
                    />
                    <span className="filter-price-currency">₽</span>
                  </div>
                </div>
              </div>

              {/* Dual Range Slider */}
              <div className="price-slider-container">
                <div className="price-slider-track-wrap">
                  {/* Gray background track */}
                  <div className="price-slider-rail" />
                  {/* Red active highlight between min and max thumbs */}
                  <div
                    className="price-slider-bar"
                    style={{
                      left: `${minPercent}%`,
                      width: `${Math.max(0, maxPercent - minPercent)}%`,
                    }}
                  />
                  {/* Left Thumb Slider */}
                  <input
                    type="range"
                    min={minLimit}
                    max={maxLimit}
                    value={priceMin}
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), priceMax);
                      setPriceMin(val);
                    }}
                    className="price-range-slider-input price-range-slider-left"
                    style={{ zIndex: priceMin > maxLimit - 50 ? 5 : 3 }}
                    aria-label="Минимальная цена"
                  />
                  {/* Right Thumb Slider */}
                  <input
                    type="range"
                    min={minLimit}
                    max={maxLimit}
                    value={priceMax}
                    onChange={(e) => {
                      const val = Math.max(Number(e.target.value), priceMin);
                      setPriceMax(val);
                    }}
                    className="price-range-slider-input price-range-slider-right"
                    style={{ zIndex: 4 }}
                    aria-label="Максимальная цена"
                  />
                </div>

                {/* Min / Max limit labels below */}
                <div className="price-slider-limits">
                  <span>{minLimit.toLocaleString('ru-RU')} ₽</span>
                  <span>{maxLimit.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            </section>

            {/* Optional Extra Attributes from backend */}
            {attributes.length > 0 && (
              <section className="filter-section">
                <h3 className="filter-section-title">Характеристики</h3>
                <div className="filter-attributes-list">
                  {attributes.map((attr: any) => (
                    <div key={attr.code} className="filter-attribute-group">
                      <label className="filter-attribute-label">{attr.name || attr.title}</label>
                      <select
                        className="filter-attribute-select"
                        value={selectedAttrs[attr.code] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedAttrs((prev) => {
                            const updated = { ...prev };
                            if (val) updated[attr.code] = val;
                            else delete updated[attr.code];
                            return updated;
                          });
                        }}
                      >
                        <option value="">Все</option>
                        {attr.values.map((v: any) => (
                          <option key={v.code || v.id} value={v.code || v.id}>
                            {v.label || v.name || v.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="filter-dialog-footer">
            <button type="submit" className="filter-apply-btn">
              Применить
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

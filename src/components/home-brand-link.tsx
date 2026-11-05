'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function HomeBrandLink({
  className,
  imageSize,
  children,
}: {
  className: string;
  imageSize: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const label = isHome ? 'Обновить главную' : 'Перейти на главную';

  return (
    <Link
      href="/"
      className={className}
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (isHome) {
          event.preventDefault();
          window.location.reload();
        }
      }}
    >
      <img
        className="brand-mark"
        src="/shop/images/brand-icon-v2.webp"
        alt=""
        width={imageSize}
        height={imageSize}
      />
      {children}
    </Link>
  );
}

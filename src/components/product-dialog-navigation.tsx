'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QuickProduct = dynamic(() => import('./products').then(m => m.QuickProduct), {ssr: false});

/** Keep the catalog and scroll position behind product links, including carousels. */
export function ProductDialogNavigation() {
  const [id, setId] = useState<number | null>(null);
  const pathname = usePathname();
  useEffect(() => { setId(null); }, [pathname]);
  useEffect(() => {
    function open(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return;
      const url = new URL(target.href, location.href);
      if (url.origin !== location.origin) return;
      const match = url.pathname.match(/^\/shop\/product\/(\d+)\/?$/);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      setId(Number(match[1]));
    }
    document.addEventListener('click', open, true);
    return () => document.removeEventListener('click', open, true);
  }, []);
  return id === null ? null : <QuickProduct key={id} id={id} onClose={() => setId(null)} />;
}

export function DirectProductDialog({id}: {id: number}) {
  const router = useRouter();
  return <QuickProduct id={id} onClose={() => router.replace('/catalog')} />;
}

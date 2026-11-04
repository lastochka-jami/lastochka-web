'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Fresh link navigation starts at the top; browser back/forward keeps its restoration. */
export function NavigationScroll() {
  const pathname = usePathname();
  const freshNavigation = useRef(false);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      freshNavigation.current = url.origin === window.location.origin && !url.hash && url.pathname !== window.location.pathname;
    };
    const history = () => { freshNavigation.current = false; };
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', history);
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', history);
    };
  }, []);

  useEffect(() => {
    if (!freshNavigation.current) return;
    freshNavigation.current = false;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

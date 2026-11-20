/** Never move a host-only session cookie to a different storefront domain. */
export function storefrontOrigin(req: Request): string {
  const allowed = [process.env.PUBLIC_ORIGIN || 'http://localhost:3000', process.env.SECONDARY_PUBLIC_ORIGIN]
    .filter((value): value is string => !!value).map(value => new URL(value).origin);
  const host = req.headers.get('host') || new URL(req.url).host;
  return allowed.find(origin => new URL(origin).host === host) || allowed[0];
}

export function validatePaymentReturn(candidate: unknown, req: Request): string | null {
  if (typeof candidate !== 'string') return null;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    if (url.origin !== storefrontOrigin(req) || url.origin !== req.headers.get('origin')) return null;
    if (url.pathname !== '/shop' && !url.pathname.startsWith('/shop/')) return null;
    return url.toString();
  } catch { return null; }
}

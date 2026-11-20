import { NextResponse } from 'next/server';
import {
  session,
  createSession,
  cookieName,
  cookieOptions,
} from '@/lib/session';
import { storefrontOrigin } from '@/lib/payment-return';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const currentSession = await session();
  const fresh = currentSession ? null : await createSession();

  const response = NextResponse.json(
    {
      authenticated: !!currentSession?.token,
      csrf: currentSession?.csrf || fresh?.csrf,
      storeId: currentSession?.store || Number(process.env.DEFAULT_STORE_ID) || 2,
      checkoutEnabled: process.env.CHECKOUT_ENABLED === 'true',
      publicOrigin: storefrontOrigin(req),
    },
    {
      headers: { 'Cache-Control': 'no-store, private' },
    },
  );

  if (fresh) {
    response.cookies.set(cookieName, fresh.id, cookieOptions);
  }

  return response;
}

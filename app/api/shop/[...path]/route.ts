import { NextResponse } from 'next/server';
import routes from '@/config/routes.json';
import {
  session,
  createSession,
  removeSession,
  cookieName,
  cookieOptions,
  rateLimit,
} from '@/lib/session';
import { validMutation } from '@/lib/guard';
import { upstream, ApiError } from '@/lib/upstream';
import { normalizePhone } from '@/lib/phone-auth';

const responseHeaders = { 'Cache-Control': 'no-store, private' };

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const segments = (await ctx.params).path;
  if (segments.some((x) => !/^[\p{L}\p{N}_-]+$/u.test(x))) {
    return NextResponse.json({ message: 'Некорректный путь' }, { status: 400 });
  }

  const path = segments.join('/');
  const method = req.method;

  const route = routes.find(
    (r) =>
      r.method === method &&
      new RegExp('^' + r.path.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path),
  );

  if (
    !route ||
    path.startsWith('fcm-tokens') ||
    path === 'analytics/events' ||
    path === 'client-ip'
  ) {
    return NextResponse.json({ message: 'Недоступно в веб-версии' }, { status: 404 });
  }

  const currentSession = await session();
  if (method !== 'GET' && !validMutation(req, currentSession)) {
    return NextResponse.json(
      { message: 'Сессия страницы истекла. Обновите страницу.' },
      { status: 403 },
    );
  }

  if (!route.public && !currentSession?.token) {
    return NextResponse.json({ message: 'Войдите по номеру телефона' }, { status: 401 });
  }

  try {
    let body: Record<string, unknown> | undefined;
    if (!['GET', 'DELETE'].includes(method) || req.headers.get('content-length')) {
      const text = await req.text();
      if (text.length > 32000) {
        return NextResponse.json({ message: 'Слишком большой запрос' }, { status: 413 });
      }
      body = text ? JSON.parse(text) : undefined;
    }

    if (path.startsWith('auth/phone-')) {
      try {
        if (!body || typeof body.phone !== 'string') throw new Error('Введите номер телефона');
        body.phone = normalizePhone(body.phone);
        if (path === 'auth/phone-confirm' && (typeof body.code !== 'string' || !/^\d{4,8}$/.test(body.code))) {
          throw new Error('Введите код подтверждения из SMS');
        }
      } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : 'Некорректный номер телефона' }, { status: 422, headers: responseHeaders });
      }
      const sessionAllowed = await rateLimit('otp-session:' + currentSession!.id, 15);
      const phoneAllowed = await rateLimit('otp-phone:' + String(body?.phone), 10);
      if (!sessionAllowed || !phoneAllowed) {
        return NextResponse.json(
          { message: 'Слишком много попыток. Попробуйте через 10 минут.' },
          { status: 429 },
        );
      }
    }

    if (path === 'orders' && method === 'POST' && process.env.CHECKOUT_ENABLED !== 'true') {
      return NextResponse.json(
        { message: 'Онлайн-оформление временно недоступно. Корзина сохранена.' },
        { status: 503 },
      );
    }

    if (typeof body?.returnUrl === 'string') {
      const configuredOrigin = new URL(process.env.PUBLIC_ORIGIN || 'http://localhost:3000').origin;
      const allowedReturnUrl = process.env.ALLOWED_PAYMENT_RETURN_URL;
      const u = new URL(body.returnUrl, configuredOrigin);
      if (allowedReturnUrl) {
        try {
          const allowedOrigin = new URL(allowedReturnUrl).origin;
          body.returnUrl = new URL(u.pathname + u.search, allowedOrigin).toString();
        } catch {
          body.returnUrl = u.toString();
        }
      } else if (u.origin !== configuredOrigin) {
        return NextResponse.json({ message: 'Недопустимый адрес возврата' }, { status: 422 });
      } else {
        body.returnUrl = u.toString();
      }
    }

    const query = new URL(req.url).search;
    const data = await upstream(path + query, { method, body, token: currentSession?.token, idempotencyKey: req.headers.get("Idempotency-Key") || undefined });

    if (path === 'auth/phone-confirm' && data?.token) {
      const fresh = await createSession(data.token, currentSession?.store);
      if (currentSession) {
        await removeSession(currentSession);
      }
      const response = NextResponse.json(
        { user: data.user, csrf: fresh.csrf },
        { headers: responseHeaders },
      );
      response.cookies.set(cookieName, fresh.id, cookieOptions);
      return response;
    }

    if (path === 'auth/logout' || path === 'auth/account') {
      if (currentSession) {
        await removeSession(currentSession);
      }
      const response = NextResponse.json({ ok: true }, { headers: responseHeaders });
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
      return response;
    }

    return NextResponse.json(data ?? { ok: true }, { headers: responseHeaders });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && currentSession) {
      await removeSession(currentSession);
      const response = NextResponse.json(err.payload, { status: 401, headers: responseHeaders });
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (path === 'auth/logout' && currentSession) {
      await removeSession(currentSession);
      const response = NextResponse.json(
        { ok: true, message: 'Вы вышли на этом устройстве.' },
        { headers: responseHeaders },
      );
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
      return response;
    }

    return NextResponse.json(
      err instanceof ApiError
        ? err.payload
        : { message: 'Не удалось связаться с магазином. Попробуйте ещё раз.' },
      { status: err instanceof ApiError ? err.status : 502, headers: responseHeaders },
    );
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};

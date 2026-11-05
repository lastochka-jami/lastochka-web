import { Session } from './session';

export function validMutation(req: Request, currentSession: Session | null): boolean {
  const origin = process.env.PUBLIC_ORIGIN || new URL(req.url).origin;
  const allowedOrigins = [origin, process.env.SECONDARY_PUBLIC_ORIGIN].filter(Boolean);
  return (
    !!currentSession &&
    allowedOrigins.includes(req.headers.get('origin') || '') &&
    req.headers.get('x-csrf-token') === currentSession.csrf &&
    req.headers.get('sec-fetch-site') !== 'cross-site'
  );
}

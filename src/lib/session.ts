import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cookies } from 'next/headers';

export const cookieName = 'lastochka_session';

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/shop',
  maxAge: 60 * 60 * 24 * 14,
};

export interface SessionRecord {
  id: string; // SHA-256 hash of public session cookie
  csrf: string;
  token: string | null; // AES-256-GCM encrypted
  expires: number;
  store: number | null;
}

export interface Session {
  id: string;
  csrf: string;
  token: string | null;
  expires: number;
  store: number | null;
}

export interface SessionStore {
  get(hashedId: string): Promise<SessionRecord | null> | SessionRecord | null;
  set(record: SessionRecord): Promise<void> | void;
  delete(hashedId: string): Promise<void> | void;
  updateStore(hashedId: string, storeId: number): Promise<void> | void;
  rateLimit(key: string, max: number, windowMs: number): Promise<boolean> | boolean;
}

/**
 * In-memory stateless session store.
 * Suitable for cloud environments without persistent disk storage or as a Redis-ready adapter.
 */
class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionRecord>();
  private rateLimits = new Map<string, { count: number; until: number }>();

  get(hashedId: string): SessionRecord | null {
    const now = Date.now();
    const record = this.sessions.get(hashedId);
    if (!record) return null;
    if (record.expires <= now) {
      this.sessions.delete(hashedId);
      return null;
    }
    return record;
  }

  set(record: SessionRecord): void {
    this.cleanup();
    this.sessions.set(record.id, record);
  }

  delete(hashedId: string): void {
    this.sessions.delete(hashedId);
  }

  updateStore(hashedId: string, storeId: number): void {
    const record = this.get(hashedId);
    if (record) {
      record.store = storeId;
      this.sessions.set(hashedId, record);
    }
  }

  rateLimit(key: string, max = 10, windowMs = 600000): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry || entry.until < now) {
      this.rateLimits.set(key, { count: 1, until: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, record] of this.sessions.entries()) {
      if (record.expires <= now) {
        this.sessions.delete(id);
      }
    }
    for (const [k, limit] of this.rateLimits.entries()) {
      if (limit.until < now) {
        this.rateLimits.delete(k);
      }
    }
  }
}

/**
 * SQLite session store.
 * Persists sessions in a local WAL-mode SQLite database.
 */
class SQLiteSessionStore implements SessionStore {
  private database: DatabaseSync | null = null;

  private getDb(): DatabaseSync {
    if (!this.database) {
      const dbPath = resolve(process.env.SESSION_DB_PATH || '.data/sessions.sqlite');
      mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
      this.database = new DatabaseSync(dbPath);
      this.database.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          csrf TEXT NOT NULL,
          token TEXT,
          expires INTEGER NOT NULL,
          store INTEGER
        );
        CREATE TABLE IF NOT EXISTS limits (
          key TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          until INTEGER NOT NULL
        );
      `);
    }
    return this.database;
  }

  get(hashedId: string): SessionRecord | null {
    const db = this.getDb();
    const result = db
      .prepare('SELECT id, csrf, token, expires, store FROM sessions WHERE id = ? AND expires > ?')
      .get(hashedId, Date.now()) as SessionRecord | undefined;
    return result || null;
  }

  set(record: SessionRecord): void {
    const db = this.getDb();
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?)').run(
      record.id,
      record.csrf,
      record.token,
      record.expires,
      record.store,
    );
  }

  delete(hashedId: string): void {
    const db = this.getDb();
    db.prepare('DELETE FROM sessions WHERE id = ?').run(hashedId);
  }

  updateStore(hashedId: string, storeId: number): void {
    const db = this.getDb();
    db.prepare('UPDATE sessions SET store = ? WHERE id = ?').run(storeId, hashedId);
  }

  rateLimit(key: string, max = 10, windowMs = 600000): boolean {
    const db = this.getDb();
    const now = Date.now();
    db.prepare('DELETE FROM limits WHERE until < ?').run(now);
    db.prepare(
      'INSERT INTO limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1',
    ).run(key, now + windowMs);
    const result = db.prepare('SELECT count FROM limits WHERE key = ?').get(key) as { count: number };
    return result.count <= max;
  }
}

let activeStore: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!activeStore) {
    const driver = process.env.SESSION_STORAGE || (process.env.SESSION_DB_PATH ? 'sqlite' : 'memory');
    if (driver === 'sqlite') {
      try {
        activeStore = new SQLiteSessionStore();
      } catch (err) {
        console.warn('Failed to initialize SQLite session store, falling back to memory:', err);
        activeStore = new MemorySessionStore();
      }
    } else {
      activeStore = new MemorySessionStore();
    }
  }
  return activeStore;
}

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

function getEncryptionKey(): Buffer {
  const value = process.env.SESSION_ENCRYPTION_KEY;
  if (value && /^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, 'hex');
  }
  if (process.env.NODE_ENV !== 'production') {
    // Deterministic fallback for local development and test runs
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  throw new Error('SESSION_ENCRYPTION_KEY is not configured');
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}

export function decrypt(cipherText: string): string {
  const buffer = Buffer.from(cipherText, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(-16);
  const encrypted = buffer.subarray(12, -16);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export async function session(): Promise<Session | null> {
  const cookieStore = await cookies();
  const rawId = cookieStore.get(cookieName)?.value;
  if (!rawId) return null;

  const store = getSessionStore();
  const record = await store.get(hash(rawId));
  if (!record) return null;

  let token: string | null = null;
  if (record.token) {
    try {
      token = decrypt(record.token);
    } catch {
      token = null;
    }
  }

  return {
    id: record.id,
    csrf: record.csrf,
    token,
    expires: record.expires,
    store: record.store,
  };
}

export async function createSession(token?: string, storeId?: number | null): Promise<{ id: string; csrf: string }> {
  const rawId = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  const hashedId = hash(rawId);

  const store = getSessionStore();
  await store.set({
    id: hashedId,
    csrf,
    token: token ? encrypt(token) : null,
    expires: Date.now() + cookieOptions.maxAge * 1000,
    store: storeId || null,
  });

  return { id: rawId, csrf };
}

export async function removeSession(s: Session): Promise<void> {
  const store = getSessionStore();
  await store.delete(s.id);
}

export async function setStore(s: Session, storeId: number): Promise<void> {
  const store = getSessionStore();
  await store.updateStore(s.id, storeId);
}

export async function rateLimit(id: string, max = 10, windowMs = 600000): Promise<boolean> {
  const store = getSessionStore();
  return store.rateLimit(hash(id), max, windowMs);
}

export function getAllowedPaymentOrigin(): string {
  if (process.env.ALLOWED_PAYMENT_RETURN_URL) {
    try {
      return new URL(process.env.ALLOWED_PAYMENT_RETURN_URL).origin;
    } catch {
      // ignore
    }
  }
  return process.env.PUBLIC_ORIGIN || 'http://localhost:3000';
}

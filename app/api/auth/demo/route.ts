import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createSession, verifyPassword, sessionCookieHeader } from '@/lib/auth';

export const runtime = 'edge';

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = body?.email;
    password = body?.password;
  } catch {
    return NextResponse.json({ ok: false, error: 'not_available' }, { status: 403 });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ ok: false, error: 'not_available' }, { status: 403 });
  }

  const db = getRequestContext().env.DB;
  const statement = db.prepare(
    'SELECT id, email, name, avatar, password_hash FROM users WHERE google_sub IS NULL AND password_hash IS NOT NULL LIMIT 1'
  );
  const row = await statement.first() as
    | { id: string; email: string; name: string; avatar: string | null; password_hash: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_available' }, { status: 403 });
  }

  if (email !== row.email || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ ok: false, error: 'not_available' }, { status: 403 });
  }

  const sessionSecret = (getRequestContext().env as unknown as Record<string, string | undefined>).SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: 'session_not_configured' }, { status: 500 });
  }

  const value = await createSession(row.id, sessionSecret);
  return NextResponse.json(
    { ok: true, user: { id: row.id, email: row.email, name: row.name, avatar: row.avatar ?? null } },
    { headers: { 'Set-Cookie': sessionCookieHeader(value) } }
  );
}

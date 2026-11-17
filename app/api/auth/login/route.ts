import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createSession, verifyPassword, sessionCookieHeader } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = body?.email;
    password = body?.password;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const db = getRequestContext().env.DB;
  const statement = db.prepare(
    'SELECT id, email, name, avatar, password_hash FROM users WHERE email = ? AND password_hash IS NOT NULL ORDER BY created_at ASC LIMIT 1'
  );
  const row = await statement.bind(normalizedEmail).first() as
    | { id: string; email: string; name: string; avatar: string | null; password_hash: string }
    | null
    | undefined;

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 403 });
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
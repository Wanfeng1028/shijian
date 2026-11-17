import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { hashPassword, createSession, sessionCookieHeader } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  let turnstileToken: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = body?.email;
    password = body?.password;
    turnstileToken = body?.turnstileToken;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  if (typeof email !== 'string' || typeof password !== 'string' || typeof turnstileToken !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  let ip: string | null = request.headers.get('cf-connecting-ip');
  if (!ip) {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      ip = xForwardedFor.split(',')[0].trim();
    }
  }
  if (!ip) {
    ip = 'unknown';
  }

  const db = getRequestContext().env.DB;
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (ip, window_start))'
    )
    .run();
  const windowStart = Math.floor(Date.now() / 1000 / 3600);
  const rateLimitRow = await db
    .prepare('SELECT count FROM rate_limits WHERE ip = ? AND window_start = ?')
    .bind(ip, windowStart)
    .first() as { count: number } | null | undefined;
  if (rateLimitRow && rateLimitRow.count >= 5) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  await db
    .prepare(
      'INSERT INTO rate_limits (ip, window_start, count) VALUES (?, ?, 1) ON CONFLICT(ip, window_start) DO UPDATE SET count = count + 1'
    )
    .bind(ip, windowStart)
    .run();

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 });
  }

  const turnstileSecret = (getRequestContext().env as unknown as Record<string, string | undefined>).TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    return NextResponse.json({ ok: false, error: 'turnstile_not_configured' }, { status: 500 });
  }
  if (turnstileToken === '') {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }
  let turnstileSuccess = false;
  try {
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken, remoteip: ip }).toString(),
    });
    const turnstileData = (await turnstileResponse.json()) as { success?: boolean };
    turnstileSuccess = turnstileData.success === true;
  } catch {
    turnstileSuccess = false;
  }
  if (!turnstileSuccess) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }

  const existingUser = await db
    .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .bind(normalizedEmail)
    .first() as { id: string } | null | undefined;
  if (existingUser) {
    return NextResponse.json({ ok: false, error: 'email_registered' }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const name = normalizedEmail.split('@')[0];
  const passwordHash = await hashPassword(password);
  const createdAt = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      'INSERT INTO users (id, google_sub, email, name, avatar, password_hash, created_at) VALUES (?, NULL, ?, ?, NULL, ?, ?)'
    )
    .bind(id, normalizedEmail, name, passwordHash, createdAt)
    .run();

  const sessionSecret = (getRequestContext().env as unknown as Record<string, string | undefined>).SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: 'session_not_configured' }, { status: 500 });
  }
  const value = await createSession(id, sessionSecret);
  return NextResponse.json(
    { ok: true, user: { id, email: normalizedEmail, name, avatar: null } },
    { headers: { 'Set-Cookie': sessionCookieHeader(value) } }
  );
}
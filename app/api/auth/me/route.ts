import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

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

export async function GET(request: Request) {
  const cookieValue = getCookie(request.headers.get('cookie'), SESSION_COOKIE);
  const sessionSecret = (getRequestContext().env as unknown as Record<string, string | undefined>).SESSION_SECRET;

  if (!cookieValue || !sessionSecret) {
    return NextResponse.json({ ok: true, user: null });
  }

  const userId = await verifySession(cookieValue, sessionSecret);
  if (userId === null) {
    return NextResponse.json({ ok: true, user: null });
  }

  const db = getRequestContext().env.DB;
  const statement = db.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?');
  const row = await statement.bind(userId).first() as
    | { id: string; email: string; name: string; avatar: string | null }
    | undefined;

  if (!row) {
    return NextResponse.json({ ok: true, user: null });
  }

  return NextResponse.json({
    ok: true, user: { id: row.id, email: row.email, name: row.name, avatar: row.avatar ?? null },
  });
}

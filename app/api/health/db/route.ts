import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const db = getRequestContext().env.DB;
  if (!db) {
    return NextResponse.json({ ok: false, error: 'D1 binding DB not configured' }, { status: 500 });
  }

  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tables = (results as { name: string }[]).map((row) => row.name);

  return NextResponse.json({ ok: true, tables });
}

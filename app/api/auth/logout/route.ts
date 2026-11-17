import { NextResponse } from 'next/server';
import { clearSessionCookieHeader } from '@/lib/auth';

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

export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookieHeader() } });
}

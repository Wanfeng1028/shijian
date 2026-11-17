import { NextResponse } from 'next/server';
import { clearSessionCookieHeader } from '@/lib/auth';

export const runtime = 'edge';


export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookieHeader() } });
}

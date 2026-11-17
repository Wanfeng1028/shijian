import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import {
  buildGoogleAuthUrl,
  generateState,
  stateCookieHeader,
} from '@/lib/auth';

export const runtime = 'edge';

export async function GET(request: Request) {
  const env = getRequestContext().env as unknown as Record<string, string | undefined>;
  const clientId = env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/login?error=google_not_configured', request.url)
    );
  }

  const redirectUri = 'https://shijian-d1r.pages.dev/api/auth/callback/google';
  const state = generateState();
  const authUrl = buildGoogleAuthUrl({ clientId, redirectUri, state });

  const response = NextResponse.redirect(authUrl);
  response.headers.set('Set-Cookie', stateCookieHeader(state));
  return response;
}

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import {
  OAUTH_STATE_COOKIE,
  createSession,
  exchangeCodeForTokens,
  fetchGoogleUserinfo,
  sessionCookieHeader,
} from '@/lib/auth';

export const runtime = 'edge';

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

function clearStateCookieHeader(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const googleError = params.get('error');

  if (googleError) {
    return NextResponse.redirect(
      new URL('/login?error=google_denied', request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    );
  }

  const stateCookie = getCookie(request.headers.get('cookie'), OAUTH_STATE_COOKIE);
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL('/login?error=invalid_state', request.url)
    );
  }

  const env = getRequestContext().env as unknown as Record<string, string | undefined>;
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = env.SESSION_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/login?error=google_not_configured', request.url)
    );
  }

  if (!sessionSecret) {
    return NextResponse.redirect(
      new URL('/login?error=session_not_configured', request.url)
    );
  }

  const redirectUri = 'https://shijian-d1r.pages.dev/api/auth/callback/google';
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>> | undefined;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch {
    return NextResponse.redirect(
      new URL('/login?error=token_failed', request.url)
    );
  }

  if (!tokens?.access_token) {
    return NextResponse.redirect(
      new URL('/login?error=token_failed', request.url)
    );
  }

  let userinfo: Awaited<ReturnType<typeof fetchGoogleUserinfo>> | undefined;
  try {
    userinfo = await fetchGoogleUserinfo(tokens.access_token);
  } catch {
    return NextResponse.redirect(
      new URL('/login?error=userinfo_failed', request.url)
    );
  }

  if (!userinfo?.sub) {
    return NextResponse.redirect(
      new URL('/login?error=userinfo_failed', request.url)
    );
  }

  const db = getRequestContext().env.DB;
  const existing = await db
    .prepare('SELECT id FROM users WHERE google_sub = ?')
    .bind(userinfo.sub)
    .first<{ id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    userId = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO users (id, google_sub, email, name, avatar, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        userId,
        userinfo.sub,
        userinfo.email ?? null,
        userinfo.name ?? null,
        userinfo.picture ?? null,
        null,
        Math.floor(Date.now() / 1000)
      )
      .run();
  }

  const sessionValue = await createSession(userId, sessionSecret);
  const response = NextResponse.redirect(new URL('/chat', request.url));
  response.headers.set('Set-Cookie', sessionCookieHeader(sessionValue));
  response.headers.append('Set-Cookie', clearStateCookieHeader());
  return response;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) {
      out += B64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)];
    }
    if (i + 2 < bytes.length) {
      out += B64_CHARS[b2 & 0x3f];
    }
  }
  return out;
}

function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const len = str.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_CHARS.indexOf(str[i]);
    const c1 = B64_CHARS.indexOf(str[i + 1]);
    const c2 = i + 2 < len ? B64_CHARS.indexOf(str[i + 2]) : -1;
    const c3 = i + 3 < len ? B64_CHARS.indexOf(str[i + 3]) : -1;
    if (c0 < 0 || c1 < 0) {
      throw new Error('invalid base64url');
    }
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) {
      bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
      if (c3 >= 0) {
        bytes.push(((c2 & 0x03) << 6) | c3);
      }
    }
  }
  return new Uint8Array(bytes);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataBytes = new TextEncoder().encode(data);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, dataBytes);
  return base64urlEncode(new Uint8Array(sig));
}

async function derivePbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, keyLength: number): Promise<ArrayBuffer> {
  const keyData = new TextEncoder().encode(password);
  const key = await globalThis.crypto.subtle.importKey('raw', keyData, 'PBKDF2', false, ['deriveBits']);
  return globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    keyLength * 8
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let acc = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    acc |= av ^ bv;
  }
  return acc === 0;
}

export const SESSION_COOKIE = '__Host-shijian-session';
export const OAUTH_STATE_COOKIE = '__Host-shijian-oauth-state';
export const SESSION_MAX_AGE = 2592000;

export async function createSession(userId: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const data = userId + '.' + exp;
  const sig = await hmacSign(data, secret);
  return userId + '.' + exp + '.' + sig;
}

export async function verifySession(value: string | null | undefined, secret: string): Promise<string | null> {
  if (!value || secret === '') return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const userId = parts[0];
  const expStr = parts[1];
  const sig = parts[2];
  if (!userId || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return null;
  const data = userId + '.' + expStr;
  const expectedSig = await hmacSign(data, secret);
  if (!constantTimeEqual(new TextEncoder().encode(expectedSig), new TextEncoder().encode(sig))) return null;
  if (Date.now() / 1000 > exp) return null;
  return userId;
}

export function sessionCookieHeader(value: string): string {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function stateCookieHeader(state: string): string {
  return `${OAUTH_STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
}

export function generateState(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const hash = await derivePbkdf2(password, salt, 100000, 32);
  return `pbkdf2$100000$${base64urlEncode(salt)}$${base64urlEncode(new Uint8Array(hash))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt: Uint8Array<ArrayBuffer>;
  let expectedHash: Uint8Array<ArrayBuffer>;
  try {
    salt = base64urlDecode(parts[2]);
    expectedHash = base64urlDecode(parts[3]);
  } catch {
    return false;
  }
  if (salt.length === 0 || expectedHash.length === 0) return false;
  const actualHash = new Uint8Array(await derivePbkdf2(password, salt, iterations, expectedHash.length));
  return constantTimeEqual(actualHash, expectedHash);
}

export interface GoogleUserinfo { sub: string; email: string; name: string; picture: string }

export function buildGoogleAuthUrl(args: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString().replace(/\+/g, '%20')}`;
}

export async function exchangeCodeForTokens(args: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error('google_token_exchange_failed');
  }
  const data = await res.json() as { access_token: string };
  return { access_token: data.access_token };
}

export async function fetchGoogleUserinfo(accessToken: string): Promise<GoogleUserinfo> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('google_userinfo_failed');
  }
  const data = await res.json() as { sub?: string; email?: string; name?: string; picture?: string };
  if (!data.sub) {
    throw new Error('google_userinfo_failed');
  }
  return {
    sub: data.sub,
    email: data.email ?? '',
    name: data.name ?? '',
    picture: data.picture ?? '',
  };
}

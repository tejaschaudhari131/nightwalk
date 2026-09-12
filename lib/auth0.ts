const text = new TextEncoder();

function b64urlToBytes(value: string) {
  const pad = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

function decodeJson(value: string) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(value)));
}

type Jwk = JsonWebKey & { kid?: string };

const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();

async function jwks(domain: string) {
  const cached = jwksCache.get(domain);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.keys;
  const res = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!res.ok) throw new Error('Auth0 keys are unavailable.');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache.set(domain, { keys: body.keys, at: Date.now() });
  return body.keys;
}

export type Auth0Identity = { id: string; name?: string; email?: string };

export async function verifyAuth0AccessToken(token: string, domain: string, audience?: string | string[]): Promise<Auth0Identity> {
  if (!domain || !token || token.split('.').length !== 3) throw new Error('Sign in with Auth0 to continue.');
  const [h, p, s] = token.split('.');
  const header = decodeJson(h) as { kid?: string; alg?: string };
  const payload = decodeJson(p) as { sub?: string; name?: string; email?: string; aud?: string | string[]; exp?: number; iss?: string };
  if (header.alg !== 'RS256') throw new Error('Unsupported Auth0 token.');
  if (!payload.sub || (payload.exp ?? 0) * 1000 < Date.now() - 30000) throw new Error('Your Auth0 session expired. Sign in again.');
  const issuer = payload.iss ?? '';
  if (issuer !== `https://${domain}/` && issuer !== `https://${domain}`) throw new Error('Auth0 token issuer did not match.');
  const allowed = (Array.isArray(audience) ? audience : [audience]).filter((value): value is string => Boolean(value));
  if (allowed.length) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!allowed.some((value) => aud.includes(value))) throw new Error('Auth0 token audience did not match.');
  }
  const key = (await jwks(domain)).find((k) => k.kid === header.kid);
  if (!key) throw new Error('Auth0 signing key was not found.');
  const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, b64urlToBytes(s), text.encode(`${h}.${p}`));
  if (!ok) throw new Error('Auth0 token signature was rejected.');
  return { id: payload.sub, name: payload.name, email: payload.email };
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', text.encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

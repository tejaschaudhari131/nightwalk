import { pkceChallenge, random } from './auth0-browser.ts';

export type Auth0Session = { accessToken: string; name?: string; email?: string; sub?: string };

const VERIFIER = 'nightwalk-auth0-verifier';
const SESSION = 'nightwalk-auth0';

function publicConfig() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return {
    domain: env.VITE_AUTH0_DOMAIN ?? env.NEXT_PUBLIC_AUTH0_DOMAIN ?? '',
    clientId: env.VITE_AUTH0_CLIENT_ID ?? env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? '',
    audience: env.VITE_AUTH0_AUDIENCE ?? env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? '',
  };
}

export function auth0Configured() {
  const { domain, clientId } = publicConfig();
  return Boolean(domain && clientId);
}

export function readAuth0Session(): Auth0Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION);
    return raw ? (JSON.parse(raw) as Auth0Session) : null;
  } catch {
    return null;
  }
}

export function auth0Headers(): Record<string, string> {
  const session = readAuth0Session();
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

export async function startAuth0Login() {
  const { domain, clientId } = publicConfig();
  if (!domain || !clientId) throw new Error('Add VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID to enable Auth0.');
  const verifier = random();
  sessionStorage.setItem(VERIFIER, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${location.origin}/`,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    state: 'nightwalk',
  });
  location.href = `https://${domain}/authorize?${params}`;
}

export async function completeAuth0Login(code: string) {
  const { domain, clientId } = publicConfig();
  const verifier = sessionStorage.getItem(VERIFIER);
  if (!verifier) throw new Error('Auth0 login expired. Try signing in again.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: `${location.origin}/`,
    code_verifier: verifier,
  });
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as { access_token?: string; id_token?: string; error_description?: string };
  if (!res.ok || (!data.id_token && !data.access_token)) throw new Error(data.error_description ?? 'Auth0 could not complete sign-in.');
  const token = data.id_token && data.id_token.split('.').length === 3 ? data.id_token : data.access_token!;
  const session: Auth0Session = { accessToken: token };
  if (data.id_token) {
    try {
      const payload = JSON.parse(atob(data.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      session.name = payload.name;
      session.email = payload.email;
      session.sub = payload.sub;
    } catch { /* keep token only */ }
  }
  sessionStorage.setItem(SESSION, JSON.stringify(session));
  sessionStorage.removeItem(VERIFIER);
  return session;
}

export function signOutAuth0() {
  const { domain, clientId } = publicConfig();
  sessionStorage.removeItem(SESSION);
  sessionStorage.removeItem(VERIFIER);
  if (domain && clientId) {
    location.href = `https://${domain}/v2/logout?${new URLSearchParams({ client_id: clientId, returnTo: location.origin + '/' })}`;
  }
}


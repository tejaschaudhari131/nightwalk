import { env } from 'cloudflare:workers';
import { Fault } from './engine.ts';
import { verifyAuth0AccessToken } from './auth0.ts';

export type Caller = { id: string; name?: string; via: 'auth0' | 'sites' };

function auth0Config() {
  const box = env as { AUTH0_DOMAIN?: string; AUTH0_AUDIENCE?: string; AUTH0_CLIENT_ID?: string };
  return { domain: box.AUTH0_DOMAIN ?? '', audience: [box.AUTH0_CLIENT_ID ?? '', box.AUTH0_AUDIENCE ?? ''].filter(Boolean) };
}

export async function caller(req: Request): Promise<Caller> {
  const bearer = req.headers.get('authorization');
  const { domain, audience } = auth0Config();
  if (bearer?.startsWith('Bearer ') && domain) {
    try {
      const claims = await verifyAuth0AccessToken(bearer.slice(7), domain, audience);
      return { id: claims.id, name: claims.name, via: 'auth0' };
    } catch (error) {
      throw new Fault(error instanceof Error ? error.message : 'Auth0 sign-in failed.', 401);
    }
  }
  const sites = req.headers.get('oai-authenticated-user-id');
  if (sites && (env as { DEPLOYMENT_TARGET?: string }).DEPLOYMENT_TARGET !== 'render') return { id: sites, via: 'sites' };
  throw new Fault('Sign in with Auth0 or ChatGPT to use NightWalk.', 401);
}

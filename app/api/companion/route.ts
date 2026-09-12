import { env } from 'cloudflare:workers';
import { caller } from '../../../lib/identity.ts';
import { Fault } from '../../../lib/engine.ts';
import { companionStatus, createBriefing, speakText } from '../../../lib/companion-service.ts';
import type { BriefingInput } from '../../../lib/sponsors.ts';

export const dynamic = 'force-dynamic';

function box() {
  const e = env as typeof env & {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_VOICE_ID?: string;
    COMPANION_URL?: string;
    AUTH0_DOMAIN?: string;
    AUTH0_AUDIENCE?: string;
  };
  return e;
}

const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

async function proxy(op: string, payload: unknown, authorization: string | null) {
  const target = box().COMPANION_URL?.replace(/\/$/, '');
  if (!target) return null;
  const res = await fetch(`${target}/v1/${op}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(payload ?? {}),
  });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const e = box();
  return json({
    auth0: Boolean(e.AUTH0_DOMAIN),
    vultr: Boolean(e.COMPANION_URL),
    ...companionStatus(e),
    mongodb: Boolean(e.COMPANION_URL),
    solana: Boolean(e.COMPANION_URL),
  });
}

export async function POST(req: Request) {
  try {
    const who = await caller(req);
    const body = (await req.json()) as { op?: string } & BriefingInput & { text?: string; agreementHash?: string; room?: unknown };
    const op = body.op ?? 'brief';
    const forwarded = await proxy(op, { ...body, caller: who }, req.headers.get('authorization'));
    if (forwarded) return forwarded;
    if (op === 'brief') {
      if (!body.plan || (body.role !== 'A' && body.role !== 'B')) throw new Fault('A matched walk is required for a briefing.');
      const briefing = await createBriefing({
        name: body.name,
        origin: body.origin,
        destination: body.destination,
        plan: body.plan,
        role: body.role,
      }, box());
      return json({ briefing, via: who.via });
    }
    if (op === 'speak') {
      const spoken = await speakText(String(body.text ?? ''), box());
      return json(spoken);
    }
    if (op === 'attest' || op === 'snapshot') {
      return json({
        ok: false,
        needsVultr: true,
        error: 'Deploy the companion API on Vultr to write MongoDB Atlas history and Solana receipts.',
      }, 501);
    }
    throw new Fault('Unknown companion operation.', 404);
  } catch (error) {
    if (error instanceof Fault) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : 'Companion request failed.' }, 503);
  }
}

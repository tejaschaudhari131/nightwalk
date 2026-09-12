import { createServer } from 'node:http';
import { createBriefing, speakText, companionStatus } from '../lib/companion-service.ts';
import { solanaMemo } from '../lib/sponsors.ts';

const port = Number(process.env.PORT || 8788);
const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID,
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain' : 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function mongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  return client.db(process.env.MONGODB_DB || 'nightwalk');
}

async function attestOnSolana(agreementHash) {
  const secret = process.env.SOLANA_SECRET_KEY;
  if (!secret) return { ok: false, error: 'SOLANA_SECRET_KEY is not configured.' };
  const web3 = await import('@solana/web3.js');
  const bytes = Uint8Array.from(JSON.parse(secret));
  const keypair = web3.Keypair.fromSecretKey(bytes);
  const connection = new web3.Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com', 'confirmed');
  const memo = solanaMemo(agreementHash);
  const tx = new web3.Transaction().add(
    new web3.TransactionInstruction({
      keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      programId: new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(memo, 'utf8'),
    }),
  );
  const signature = await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
  const cluster = (process.env.SOLANA_RPC || '').includes('mainnet') ? '' : '?cluster=devnet';
  return {
    ok: true,
    signature,
    memo,
    explorer: `https://explorer.solana.com/tx/${signature}${cluster}`,
    network: process.env.SOLANA_RPC || 'https://api.devnet.solana.com',
  };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const url = new URL(req.url || '/', 'http://companion.local');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return send(res, 200, {
        ok: true,
        service: 'nightwalk-companion',
        host: 'vultr',
        ...companionStatus(env),
        mongodb: Boolean(process.env.MONGODB_URI),
        solana: Boolean(process.env.SOLANA_SECRET_KEY),
      });
    }
    if (req.method !== 'POST' || !url.pathname.startsWith('/v1/')) return send(res, 404, { error: 'Unknown companion route.' });
    const op = url.pathname.slice(4);
    const body = await readJson(req);
    if (op === 'brief') {
      const briefing = await createBriefing(body, env);
      const db = await mongo();
      if (db) {
        await db.collection('briefings').insertOne({
          at: new Date(),
          caller: body.caller ?? null,
          facts: { origin: body.origin, meet: body.plan?.meeting, split: body.plan?.split },
          source: briefing.source,
        });
        await db.collection('users').updateOne(
          { id: body.caller?.id || 'anonymous' },
          { $set: { id: body.caller?.id, name: body.caller?.name, via: body.caller?.via, lastSeen: new Date() } },
          { upsert: true },
        );
      }
      return send(res, 200, { briefing, stored: Boolean(db), host: 'vultr' });
    }
    if (op === 'speak') {
      return send(res, 200, await speakText(String(body.text ?? ''), env));
    }
    if (op === 'attest') {
      const receipt = await attestOnSolana(String(body.agreementHash ?? ''));
      const db = await mongo();
      if (db && receipt.ok) {
        await db.collection('attestations').insertOne({
          at: new Date(),
          caller: body.caller ?? null,
          agreementHash: body.agreementHash,
          signature: receipt.signature,
          explorer: receipt.explorer,
        });
      }
      return send(res, receipt.ok ? 200 : 501, { ...receipt, stored: Boolean(db && receipt.ok), host: 'vultr' });
    }
    if (op === 'snapshot') {
      const db = await mongo();
      if (!db) return send(res, 501, { ok: false, error: 'MONGODB_URI is not configured.' });
      const room = body.room ?? {};
      await db.collection('walks').updateOne(
        { id: room.id },
        {
          $set: {
            id: room.id,
            status: room.status,
            role: room.role,
            updatedAt: new Date(),
            caller: body.caller ?? null,
            timerState: room.me?.timer?.state ?? room.timer?.state ?? null,
            agreementHash: room.agreementHash ?? null,
          },
        },
        { upsert: true },
      );
      if (room.me?.timer?.state === 'alerted') {
        await db.collection('incidents').updateOne(
          { roomId: room.id, role: room.role, alertedAt: room.me.timer.alertedAt },
          { $set: { roomId: room.id, role: room.role, alertedAt: room.me.timer.alertedAt, name: room.me?.name, updatedAt: new Date() } },
          { upsert: true },
        );
      }
      return send(res, 200, { ok: true, stored: true, host: 'vultr' });
    }
    return send(res, 404, { error: 'Unknown companion operation.' });
  } catch (error) {
    console.error('Companion failure', error);
    send(res, 503, { error: error instanceof Error ? error.message : 'Companion failed.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`NightWalk companion on :${port}`);
});

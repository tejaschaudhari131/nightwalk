'use client';
import { useEffect, useState } from 'react';
import { Volume2, Sparkles, Link2, Database, Cloud, ShieldCheck, LoaderCircle } from 'lucide-react';
import { auth0Headers } from './auth0-client';
import type { WalkBriefing } from '../lib/sponsors';

type Props = { room: any };

async function companion(op: string, body: Record<string, unknown> = {}) {
  const res = await fetch('/api/companion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth0Headers() },
    body: JSON.stringify({ op, ...body }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Companion request failed.');
  return data;
}

export default function SponsorsPanel({ room }: Props) {
  const [briefing, setBriefing] = useState<WalkBriefing | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [stored, setStored] = useState(false);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/companion').then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!room?.id) return;
    companion('snapshot', { room }).then((r) => setStored(!!r.stored)).catch(() => setStored(false));
  }, [room?.id, room?.status, room?.agreementHash, room?.me?.timer?.state]);

  const payload = () => ({
    name: room.me.name,
    origin: room.me.intent.origin,
    destination: room.me.intent.destination,
    plan: room.plan,
    role: room.role,
  });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That sponsor action failed.');
    } finally {
      setBusy('');
    }
  }

  async function play(text: string) {
    const spoken = await companion('speak', { text });
    if (!spoken.audio) {
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(spoken.spoken));
        return;
      }
      throw new Error('Add ELEVENLABS_API_KEY on the companion API to hear this briefing.');
    }
    const audio = new Audio(`data:${spoken.mime};base64,${spoken.audio}`);
    await audio.play();
  }

  if (!room?.plan || room.role?.startsWith('T')) return null;

  return (
    <section className="sponsor-panel">
      <div className="section-title">
        <h3>Walk briefing</h3>
        <span className="pill">HACKCMU</span>
      </div>
      <p className="small muted">Gemini writes a calm briefing from your endpoints and the shared stretch. ElevenLabs reads it. The companion’s destination is never sent.</p>
      <div className="sponsor-marks">
        <span className={status?.gemini ? 'on' : ''}>Gemini</span>
        <span className={status?.elevenlabs ? 'on' : ''}>ElevenLabs</span>
        <span className={status?.mongodb || stored ? 'on' : ''}>MongoDB</span>
        <span className={status?.solana || receipt?.ok ? 'on' : ''}>Solana</span>
        <span className={status?.vultr ? 'on' : ''}>Vultr</span>
        <span className={status?.auth0 ? 'on' : ''}>Auth0</span>
      </div>
      <button className="button" disabled={!!busy} onClick={() => run('brief', async () => { setBriefing((await companion('brief', payload())).briefing); })}>
        {busy === 'brief' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Ask Gemini for my briefing
      </button>
      {briefing && (
        <div className="briefing-card">
          <strong>{briefing.headline}</strong>
          <ol>{briefing.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p className="small muted">{briefing.caution}</p>
          <span className="source-tag">{briefing.source === 'gemini' ? 'Gemini API' : 'Local fallback · add GEMINI_API_KEY'}</span>
          <button className="button secondary" disabled={!!busy} onClick={() => run('speak', () => play(briefing.spoken))}>
            {busy === 'speak' ? <LoaderCircle className="spin" size={16} /> : <Volume2 size={16} />} Listen with ElevenLabs
          </button>
        </div>
      )}
      {room.agreementHash && room.signatures?.A && room.signatures?.B && (
        <button className="button secondary" disabled={!!busy} onClick={() => run('attest', async () => { setReceipt(await companion('attest', { agreementHash: room.agreementHash })); })}>
          {busy === 'attest' ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Attest agreement hash on Solana
        </button>
      )}
      {receipt?.ok && (
        <p className="small">
          <Cloud size={13} /> Receipt {receipt.signature.slice(0, 12)}…{' '}
          <a href={receipt.explorer} target="_blank" rel="noreferrer">Solana explorer</a>
        </p>
      )}
      {receipt && !receipt.ok && <p className="small muted">{receipt.error}</p>}
      <ul className="sponsor-notes">
        <li><Database size={14} /> {stored ? 'Walk snapshot saved to MongoDB Atlas.' : 'Vultr companion writes walk history to MongoDB Atlas.'}</li>
        <li><ShieldCheck size={14} /> Solana stores only the agreement hash — not names, routes, or destinations.</li>
      </ul>
      {error && <p className="small" style={{ color: '#974d39' }}>{error}</p>}
    </section>
  );
}

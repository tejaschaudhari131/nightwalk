import test from 'node:test';
import assert from 'node:assert/strict';
import { briefingFacts, localBriefing, parseBriefing, solanaMemo } from '../lib/sponsors.ts';
import { match } from '../lib/graph.ts';

const now = Date.now();
const a = { origin: 'gates', destination: 'morewood', leaveAt: now, window: 5, detour: 2, wait: 5 };
const b = { origin: 'wean', destination: 'resnik', leaveAt: now, window: 5, detour: 2, wait: 5 };
const plan = match(a, b)!;

test('briefing facts keep the companion destination off the model payload', () => {
  assert.ok(plan);
  const facts = briefingFacts({ name: 'Tejas', origin: a.origin, destination: a.destination, plan, role: 'A' });
  const raw = JSON.stringify(facts);
  assert.equal(raw.includes('resnik'), false);
  assert.equal(raw.includes('Resnik'), false);
  assert.equal(facts.origin, 'Gates Center');
  assert.equal(facts.destination, 'Morewood area');
  assert.ok(facts.meet);
  assert.ok(facts.split);
});

test('local briefing is speakable and names only this walker\'s finish', () => {
  const brief = localBriefing({ name: 'Alex', origin: b.origin, destination: b.destination, plan, role: 'B' });
  assert.equal(brief.source, 'local');
  assert.match(brief.spoken, /Alex/);
  assert.match(brief.spoken, /Resnik/);
  assert.doesNotMatch(brief.spoken, /Morewood/);
  assert.ok(brief.steps.length >= 3);
});

test('parseBriefing falls back when Gemini returns prose', () => {
  const fallback = localBriefing({ name: 'Tejas', origin: a.origin, destination: a.destination, plan, role: 'A' });
  const parsed = parseBriefing('sorry, I cannot', fallback);
  assert.equal(parsed.source, 'local');
  assert.equal(parsed.headline, fallback.headline);
});

test('solana memo is the agreement hash only', () => {
  const memo = solanaMemo('abc123hash');
  assert.equal(memo, 'nightwalk.v1:abc123hash');
  assert.doesNotMatch(memo, /gates|morewood|Tejas/);
});

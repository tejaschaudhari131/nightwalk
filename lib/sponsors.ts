import { label, type Plan } from './graph.ts';

export type WalkBriefing = {
  headline: string;
  steps: string[];
  caution: string;
  spoken: string;
  source: 'gemini' | 'local';
};

export type BriefingInput = {
  name: string;
  origin: string;
  destination: string;
  plan: Pick<Plan, 'meeting' | 'split' | 'path' | 'minutes' | 'extraA' | 'extraB' | 'waitA' | 'waitB'>;
  role: 'A' | 'B';
};

/** Only this walker's endpoints plus the shared stretch — never the companion's destination. */
export function briefingFacts(input: BriefingInput) {
  const extra = input.role === 'A' ? input.plan.extraA : input.plan.extraB;
  const wait = input.role === 'A' ? input.plan.waitA : input.plan.waitB;
  return {
    walker: input.name,
    origin: label(input.origin),
    destination: label(input.destination),
    meet: label(input.plan.meeting),
    split: label(input.plan.split),
    sharedMinutes: input.plan.minutes,
    extraMinutes: extra,
    waitMinutes: Math.round(wait * 10) / 10,
    sharedStops: input.plan.path.map(label),
  };
}

export function localBriefing(input: BriefingInput): WalkBriefing {
  const f = briefingFacts(input);
  const steps = [
    `Leave ${f.origin} and meet ${f.walker === input.name ? 'your companion' : f.walker} at ${f.meet}.`,
    `Walk the shared stretch together for about ${f.sharedMinutes} minutes: ${f.sharedStops.join(' → ')}.`,
    `Split at ${f.split}. Continue on your own to ${f.destination}.`,
  ];
  if (f.extraMinutes > 0) steps.push(`This overlap adds about ${f.extraMinutes} minute${f.extraMinutes === 1 ? '' : 's'} to your solo walk.`);
  if (f.waitMinutes > 0) steps.push(`You may wait up to ${f.waitMinutes} minutes at the meeting point.`);
  const spoken = `${f.walker}, meet at ${f.meet}. Walk together to ${f.split}, about ${f.sharedMinutes} minutes. Then continue to ${f.destination} on your own. This is a planned route, not live navigation.`;
  return {
    headline: `Meet at ${f.meet}. Split at ${f.split}.`,
    steps,
    caution: 'This briefing describes the agreed campus path. It does not confirm anyone is physically there, and it cannot call for help.',
    spoken,
    source: 'local',
  };
}

export function geminiPrompt(input: BriefingInput) {
  const facts = briefingFacts(input);
  return {
    system: 'You write short, calm campus-walk briefings for NightWalk. Use only the supplied facts. Do not invent streets, emergencies, police advice, or the companion\'s destination. Never claim GPS or physical presence. Return JSON only.',
    user: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON with keys headline (one sentence), steps (3-5 short strings), caution (one sentence about limits), spoken (80-160 words, easy to read aloud).`,
  };
}

export function parseBriefing(raw: string, fallback: WalkBriefing): WalkBriefing {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<WalkBriefing>;
    if (!parsed.headline || !Array.isArray(parsed.steps) || !parsed.spoken) return fallback;
    return {
      headline: String(parsed.headline).slice(0, 180),
      steps: parsed.steps.map((s) => String(s).slice(0, 240)).slice(0, 6),
      caution: String(parsed.caution ?? fallback.caution).slice(0, 280),
      spoken: String(parsed.spoken).slice(0, 800),
      source: 'gemini',
    };
  } catch {
    return fallback;
  }
}

export function solanaMemo(agreementHash: string) {
  if (!agreementHash || agreementHash.length > 120) throw new Error('Missing agreement hash.');
  return `nightwalk.v1:${agreementHash}`;
}

import { briefingFacts, geminiPrompt, localBriefing, parseBriefing, type BriefingInput, type WalkBriefing } from './sponsors.ts';

export type CompanionEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  COMPANION_URL?: string;
};

export function companionStatus(env: CompanionEnv) {
  return {
    gemini: Boolean(env.GEMINI_API_KEY),
    elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
    model: env.GEMINI_MODEL || 'gemini-flash-latest',
  };
}

export async function createBriefing(input: BriefingInput, env: CompanionEnv): Promise<WalkBriefing> {
  const fallback = localBriefing(input);
  if (!env.GEMINI_API_KEY) return fallback;
  const prompt = geminiPrompt(input);
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) return fallback;
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseBriefing(text, fallback);
}

export async function speakText(text: string, env: CompanionEnv): Promise<{ audio: string | null; mime: string; source: 'elevenlabs' | 'text'; spoken: string }> {
  const spoken = text.slice(0, 800);
  if (!env.ELEVENLABS_API_KEY) return { audio: null, mime: 'text/plain', source: 'text', spoken };
  const voice = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY, accept: 'audio/mpeg' },
    body: JSON.stringify({ text: spoken, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) return { audio: null, mime: 'text/plain', source: 'text', spoken };
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { audio: btoa(binary), mime: 'audio/mpeg', source: 'elevenlabs', spoken };
}

export { briefingFacts };

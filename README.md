# NightWalk

A working private campus-walk prototype with route overlap matching, QR meeting confirmation, independently signed walk agreements, signed actions, and trusted-contact timer views.

## Run locally

Requires Node 24 (or Node 22.13+ for the app), npm, and a supported modern browser.

1. `npm ci`
2. `npm run build`
3. `node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_keen_greymalkin.sql --persist-to .wrangler/state`
4. `npm run dev`
5. Open the printed localhost URL. Sign in through the local `/signin-with-chatgpt?return_to=/` route when prompted. This development-only sign-in is supplied by the Sites starter and is not part of production authentication.

On this Windows Codex environment the npm executable was provisioned in the parent `work/tooling` directory. A development-only preload in `work/windows-runtime.cjs` worked around a sandbox OS-user-info error for Drizzle. Neither is needed on an ordinary configured Node environment or included in the hosted application.

## Demonstration

Choose **Try the two-walker demo**, then **Add Alex**. Accept on Tejas's device, switch to Alex, and accept. Verify the companion's demo code on each device. Sign on both. Send a check-in and open **Verification lab**. Its checks use real ECDSA verification and the real signed-action endpoint.

For separate device testing, start a private walk and copy its companion invitation. Each browser creates and stores its own non-extractable key. Owner-private hosting means both browser sessions must sign in to the owner's ChatGPT account. Do not share account credentials; the guided demo is the practical presentation option on private hosting. A campus pilot requires a separately configured audience and actual eligible student authentication.

The contacts screen creates a separate single-use contact invitation. Open its contact view, join and accept, then arm a personal timer on the walker screen. The optional demo timer lasts 30 seconds. Alerts are persistent **in-app incidents**; no SMS, email, browser push or emergency dispatch is connected. The contact must open its view to see the alert. A one-minute scheduled sweep handler and Cron configuration are included for a host supporting scheduled Workers. Sites-specific autonomous scheduling has not been confirmed; reads and writes also reconcile elapsed deadlines. Do not promise an external or background notification.

## Security design

- ECDSA P-256 / SHA-256 via Web Crypto; RFC 8785 canonical JSON through json-canonicalize.
- Independent session keys, proof of possession, QR exchange, locally pinned peer key, and two signatures over the same immutable plan.
- Signed actions bound to participant, session, agreement hash, single-use challenge, sequence, expiry, and exact payload.
- Authenticated workspace plus random per-device bearer tokens. Tokens/invites are stored hashed server-side. Private keys stay in IndexedDB.
- D1 optimistic compare-and-swap on the room revision makes each entire state transition atomic, including challenge consumption and idempotent action results.
- Owner-only API reads; peer destinations and personal timer details are filtered on the server.
- Planned route data is illustrative, not navigation. Signatures authenticate messages, not physical presence or safety.
- Authentication, application delivery, and the backend operator are trusted. This is not end-to-end encryption, audited safety software, or protection from compromised devices.

## Persistence

`db/schema.ts` and generated `drizzle/` migrations define the D1 walks table. Each room contains bounded structured session state, challenges, signed-action receipts and timer incidents. A maximum 400 actions bounds room size. Records become inaccessible 24 hours after creation; the sweep deletes expired rows when invoked. Platform logs and backups have their own retention. Local session key removal is available when the participant's own timer is terminal.

## Tests

- `node --experimental-transform-types --test tests/protocol.test.ts` — 17 protocol/matching cases.
- `node --experimental-transform-types tests/api-flow.ts` — live local API flow, needs the dev server and schema; creates labeled test accounts and waits for a 30-second timer.
- `node node_modules/typescript/bin/tsc --noEmit` — type checks.

The browser flow was also exercised via the same UI action functions exposed by WebMCP. Mouse automation in this environment intermittently timed out; the structured browser controls completed the visible flow.

## Structure

- `app/nightwalk.tsx`: application UI, device flows and scoped WebMCP controls.
- `app/campus-map.tsx`, `lib/graph.ts`: illustrative pedestrian graph and matching.
- `lib/crypto.ts`, `lib/engine.ts`: cryptography and state transitions.
- `lib/vault.ts`: device-local key and credential storage.
- `app/api/nightwalk/route.ts`, `lib/store.ts`: scoped API and durable state.
- `app/api/companion/route.ts`, `companion/`: Gemini, ElevenLabs, MongoDB Atlas, and Solana via a Vultr-hosted API.
- `worker.ts`: web request handler and scheduled timer sweep.

No real campus directory verification, public stranger marketplace, block/report moderation, SMS provider or police integration is included. Those are pilot requirements rather than demonstrated capabilities.

## HackCMU sponsor stack

Each prize track maps to a real NightWalk gap. Copy `.env.example` to `.env` (and `.dev.vars` for the worker). Keys stay on the server.

| Track | What NightWalk does with it |
| --- | --- |
| **Auth0** | Students sign in with their own account. Join and campus discover no longer require the same ChatGPT owner login. |
| **Gemini API** | Writes a walk briefing from *your* origin/destination plus the shared stretch. The companion’s destination is never sent. |
| **ElevenLabs** | Reads that briefing aloud. Without a key, the browser speech API is a labeled fallback. |
| **MongoDB Atlas** | The Vultr companion stores users, briefings, walk snapshots, timer incidents, and Solana receipts. |
| **Solana** | After both devices sign, optional memo of `nightwalk.v1:<agreementHash>` on devnet. No names or routes on-chain. |
| **Vultr** | Host `companion/` (`Dockerfile`). Point `COMPANION_URL` at that origin. |

Local companion: `npm run companion` then `COMPANION_URL=http://127.0.0.1:8788`. Without keys the UI still runs; Gemini/ElevenLabs/Mongo/Solana pills light up as each secret is added.

## Deploy on Render

`render.yaml` defines a free Node 24 web service and free Postgres 17 database in Ohio. Render builds with `npm ci --include=dev && npm run build:render`, starts with `npm run start:render`, and checks `/api/health`. The Node runtime reads credentials only from server environment variables. A Postgres adapter preserves the protocol's atomic revision checks. Schema initialization runs at startup and is idempotent.

Set `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `VITE_AUTH0_DOMAIN`, and `VITE_AUTH0_CLIENT_ID` in Render. The VITE values are public SPA configuration; database and provider credentials must never use a VITE prefix. Configure Auth0's allowed callback and logout URLs with the deployed HTTPS origin followed by `/`, and allowed web origins with the origin itself. Sites sign-in headers are rejected by the Render build.

Optional server variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `COMPANION_URL`. Without these, briefings use the labeled local fallback and optional sponsor features remain unavailable. The companion is a separate service and is not included in this Blueprint.

The free service sleeps after 15 minutes idle and the free Postgres database expires after 30 days. The timer reconciler runs every 30 seconds while the process is awake, plus on application reads/writes. This remains a demonstration with in-app incidents, not dependable background emergency alerts. See https://render.com/docs/free.

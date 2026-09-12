import { startProdServer } from 'vinext/server/prod-server';
import { migrate, connection, close } from './postgres.mjs';
import { tick } from '../lib/engine.ts';

if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID) {
  throw new Error('AUTH0_DOMAIN and AUTH0_CLIENT_ID must be configured.');
}
await migrate();
const { server } = await startProdServer({ host: '0.0.0.0', port: Number(process.env.PORT || 10000) });
let sweeping = false;
async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const now = Date.now();
    const { rows } = await connection().query('SELECT id, revision, state FROM walks WHERE next_due <= $1 AND expires > $1 LIMIT 100', [now]);
    for (const row of rows) {
      const room = JSON.parse(row.state);
      if (!tick(room, now)) continue;
      room.rev = row.revision + 1;
      const due = [room.a.timer, room.b?.timer].filter(t => t?.state === 'armed').map(t => t.due + t.grace);
      await connection().query('UPDATE walks SET state=$1, revision=$2, next_due=$3 WHERE id=$4 AND revision=$5',
        [JSON.stringify(room), room.rev, due.length ? Math.min(...due) : null, row.id, row.revision]);
    }
    await connection().query('DELETE FROM walks WHERE expires <= $1', [now]);
  } catch { console.error('Timer reconciliation failed; pending timers will be retried.'); }
  finally { sweeping = false; }
}
const interval = setInterval(sweep, 30000);
interval.unref();
void sweep();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  clearInterval(interval);
  server.close();
  await close();
  process.exit(0);
});


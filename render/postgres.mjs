import pg from 'pg';

let pool;
export function connection() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
}

// The application's small SQL surface uses positional D1 parameters. Keep the
// existing revision compare-and-swap as one atomic Postgres UPDATE.
export function statement(sql, values = []) {
  let index = 0;
  const query = sql.replace(/\?/g, () => `$${++index}`);
  const execute = () => connection().query(query, values);
  return {
    bind(...args) { return statement(sql, args); },
    async first() { return (await execute()).rows[0] ?? null; },
    async all() { return { results: (await execute()).rows }; },
    async run() { return { meta: { changes: (await execute()).rowCount } }; },
  };
}
export const database = { prepare: statement };

export async function migrate() {
  await connection().query(`CREATE TABLE IF NOT EXISTS walks (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL, expires BIGINT NOT NULL, next_due BIGINT
  );
  CREATE INDEX IF NOT EXISTS walk_owner ON walks(owner);
  CREATE INDEX IF NOT EXISTS walk_due ON walks(next_due);
  CREATE INDEX IF NOT EXISTS walk_expiry ON walks(expires);`);
}

export async function close() { if (pool) await pool.end(); }

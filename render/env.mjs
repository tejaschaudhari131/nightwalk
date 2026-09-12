import { database } from './postgres.mjs';

// Build-time alias for server-only Cloudflare bindings. Credentials are read at
// runtime and are never copied into client assets or hosting manifests.
export const env = new Proxy({}, {
  get(_target, key) {
    if (key === 'DB') return database;
    if (key === 'DEPLOYMENT_TARGET') return 'render';
    return process.env[key];
  },
});

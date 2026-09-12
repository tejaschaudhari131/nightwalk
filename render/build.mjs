import { createBuilder } from 'vite';
await (await createBuilder({ configFile: 'vite.render.config.ts', mode: 'production' })).buildApp();

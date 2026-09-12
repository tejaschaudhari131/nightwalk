import handler from 'vinext/server/fetch-handler';
import { sweep } from './lib/store.ts';
export default {
 fetch: handler.fetch,
 async scheduled(_event:ScheduledController,_env:unknown,ctx:ExecutionContext){ctx.waitUntil(sweep());},
};

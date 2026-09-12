import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const walks = sqliteTable('walks', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), revision:integer('revision').notNull().default(0),
 state:text('state').notNull(), expires:integer('expires').notNull(), nextDue:integer('next_due'),
}, t=>[index('walk_owner').on(t.owner),index('walk_due').on(t.nextDue),index('walk_expiry').on(t.expires)]);

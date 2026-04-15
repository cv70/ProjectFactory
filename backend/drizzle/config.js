import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { config } from '../src/config/index.js';
const sqlite = new Database(config.database.path);
export const db = drizzle(sqlite, { schema });
//# sourceMappingURL=config.js.map
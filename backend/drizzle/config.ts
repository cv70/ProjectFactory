import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { config } from '../src/config/index.js';

const sqlite = new Database(config.database.path);
export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
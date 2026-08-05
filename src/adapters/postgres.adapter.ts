import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { loadEnv } from '../config/env.js';
import * as schema from './postgres.schema.js';

let sharedDb: PostgresJsDatabase<typeof schema> | null = null;

/** Única camada que abre conexão Postgres direta — repositórios recebem este client via DI. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!sharedDb) {
    const sql = postgres(loadEnv().DATABASE_URL);
    sharedDb = drizzle(sql, { schema });
  }
  return sharedDb;
}

export type Db = PostgresJsDatabase<typeof schema>;

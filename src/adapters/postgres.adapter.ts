import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { loadEnv } from '../config/env.js';
import * as schema from './postgres.schema.js';
import { logger } from '../shared/logger.js';

let sharedDb: PostgresJsDatabase<typeof schema> | null = null;

/** Única camada que abre conexão Postgres direta — repositórios recebem este client via DI. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!sharedDb) {
    logger.info('Postgres/Supabase: abrindo pool de conexão');
    const sql = postgres(loadEnv().DATABASE_URL, {
      onnotice: (notice) => logger.debug({ notice }, 'Postgres: notice do servidor'),
      onclose: (connId) => logger.warn({ connId }, 'Postgres: conexão do pool fechada'),
      // LOG_LEVEL=debug mostra cada query (INSERT/SELECT) e seus parâmetros — útil pra
      // confirmar que uma tool realmente gravou algo no Supabase, e não só "não deu erro".
      debug: (_connId, query, params) => {
        logger.debug({ query, params }, 'Postgres: query executada');
      },
    });
    sharedDb = drizzle(sql, { schema });
  }
  return sharedDb;
}

export type Db = PostgresJsDatabase<typeof schema>;

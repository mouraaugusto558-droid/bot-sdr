import { eq } from 'drizzle-orm';
import type { Db } from '../adapters/postgres.adapter.js';
import { preAgendamentos } from '../adapters/postgres.schema.js';

export interface PreAgendamentosRepository {
  /** true quando já existe pré-agendamento salvo para este cliente (gatilho do silêncio total). */
  exists(userID: string): Promise<boolean>;
}

export function createPreAgendamentosRepository(db: Db): PreAgendamentosRepository {
  return {
    async exists(userID) {
      const rows = await db
        .select({ id: preAgendamentos.id })
        .from(preAgendamentos)
        .where(eq(preAgendamentos.userID, userID))
        .limit(1);
      return rows.length > 0;
    },
  };
}

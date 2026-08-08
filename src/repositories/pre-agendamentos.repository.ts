import type { Db } from '../adapters/postgres.adapter.js';
import { preAgendamentos } from '../adapters/postgres.schema.js';

export interface PreAgendamentosRepository {
  /** Equivalente à tool "Anotar". */
  register(input: { userID: string; nomeCompleto: string; periodoDoDia: string; dataEnvio: Date }): Promise<void>;
}

export function createPreAgendamentosRepository(db: Db): PreAgendamentosRepository {
  return {
    async register(input) {
      await db.insert(preAgendamentos).values({
        userID: input.userID,
        nomeCompleto: input.nomeCompleto,
        periodoDoDia: input.periodoDoDia,
        dataEnvio: input.dataEnvio,
      });
    },
  };
}

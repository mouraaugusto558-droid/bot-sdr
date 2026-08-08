import type { Db } from '../adapters/postgres.adapter.js';
import { leadsQuentes } from '../adapters/postgres.schema.js';

/** Equivalente à tool "leadsQuentes" — tabela `leads_quentes`. */
export interface LeadsQuentesRepository {
  register(input: { nome: string | null; numero: string; criadoEm: Date }): Promise<void>;
}

export function createLeadsQuentesRepository(db: Db): LeadsQuentesRepository {
  return {
    async register(input) {
      await db.insert(leadsQuentes).values({
        nome: input.nome,
        numero: input.numero,
        criadoEm: input.criadoEm,
      });
    },
  };
}

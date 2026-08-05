import type { Db } from '../adapters/postgres.adapter.js';
import { atendimentoHumano } from '../adapters/postgres.schema.js';

/** Equivalente à tool "AtendimentoHumano" — tabela `atendimento_humano`. */
export interface AtendimentoHumanoRepository {
  register(input: { telefone: string; nome: string | null; dataEnvio: Date }): Promise<void>;
}

export function createAtendimentoHumanoRepository(db: Db): AtendimentoHumanoRepository {
  return {
    async register(input) {
      await db.insert(atendimentoHumano).values({
        telefone: input.telefone,
        nome: input.nome,
        dataEnvio: input.dataEnvio,
      });
    },
  };
}

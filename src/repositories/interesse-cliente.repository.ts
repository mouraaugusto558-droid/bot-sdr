import type { Db } from '../adapters/postgres.adapter.js';
import { interesseCliente } from '../adapters/postgres.schema.js';

/** Equivalente à tool "Procedimento" — tabela `"Interesse do cliente"`. */
export interface InteresseClienteRepository {
  register(input: { userID: string; procedimento: string; dataEnvio: Date }): Promise<void>;
}

export function createInteresseClienteRepository(db: Db): InteresseClienteRepository {
  return {
    async register(input) {
      await db.insert(interesseCliente).values({
        userID: input.userID,
        procedimento: input.procedimento,
        dataEnvio: input.dataEnvio,
      });
    },
  };
}

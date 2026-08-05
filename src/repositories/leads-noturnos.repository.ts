import { eq } from 'drizzle-orm';
import type { Db } from '../adapters/postgres.adapter.js';
import { leadsNoturnos } from '../adapters/postgres.schema.js';

export interface LeadsNoturnosRepository {
  exists(numeroUsuario: string): Promise<boolean>;
  register(input: { numeroUsuario: string; nomeUsuario: string | null; dataEnvio: Date }): Promise<void>;
}

export function createLeadsNoturnosRepository(db: Db): LeadsNoturnosRepository {
  return {
    async exists(numeroUsuario) {
      const rows = await db
        .select({ id: leadsNoturnos.id })
        .from(leadsNoturnos)
        .where(eq(leadsNoturnos.numeroUsuario, numeroUsuario))
        .limit(1);
      return rows.length > 0;
    },
    async register(input) {
      await db.insert(leadsNoturnos).values({
        numeroUsuario: input.numeroUsuario,
        nomeUsuario: input.nomeUsuario,
        dataEnvio: input.dataEnvio,
      });
    },
  };
}

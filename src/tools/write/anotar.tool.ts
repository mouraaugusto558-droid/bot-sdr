import { z } from 'zod';
import type { PreAgendamentosRepository } from '../../repositories/pre-agendamentos.repository.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Equivalente ao node "Anotar" (`n8n-nodes-base.supabaseTool` → `"pré agendamentos"`).
 * `userID`/`Data_envio` vêm do contexto; `nomeCompleto`/`periodoDoDia` vêm do LLM (`$fromAI`).
 * É o próprio gatilho do silêncio total pós-agendamento (docs/reverse-engineering.md, Seção 4)
 * — não reforçar nenhuma lógica extra aqui além do insert em si.
 *
 * O node original não define uma `toolDescription` manual (usa o texto auto-gerado padrão do
 * n8n para supabaseTool, não capturado no export) — descrição abaixo é equivalente funcional.
 */
const inputSchema = z.object({
  nomeCompleto: z.string().describe('é o nome completo que o cliente deve informar'),
  periodoDoDia: z.string().describe('é o período ou horário que o cliente deve informar'),
});

const DESCRIPTION =
  'Registra o pré-agendamento da avaliação do cliente, com nome completo e período/horário preferido.';

export function createAnotarTool(repo: PreAgendamentosRepository): ToolSpec<typeof inputSchema> {
  return {
    name: 'Anotar',
    description: DESCRIPTION,
    inputSchema,
    async execute(input, ctx) {
      await repo.register({
        userID: ctx.contactInboxSourceId,
        nomeCompleto: input.nomeCompleto,
        periodoDoDia: input.periodoDoDia,
        dataEnvio: new Date(),
      });
      return 'Pré-agendamento registrado com sucesso.';
    },
  };
}

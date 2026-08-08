import { z } from 'zod';
import type { InteresseClienteRepository } from '../../repositories/interesse-cliente.repository.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Equivalente ao node "Procedimento" (`n8n-nodes-base.supabaseTool` → `"Interesse do cliente"`).
 * `userID`/`Data_envio` vêm do contexto (Webhook1/Data&Time), só `procedimento` vem do LLM
 * (`$fromAI`). Regra "1x por conversa, só o 1º procedimento" só existe no prompt — não
 * reforçada aqui (ver docs/reverse-engineering.md, Seção 7 e plano, Seção 4).
 */
const inputSchema = z.object({
  procedimento: z.string().describe('é o nome do procedimento que o cliente deve informar'),
});

const DESCRIPTION =
  'Acione essa ferramenta quando o cliente falar o procedimento que ele tem interesse e informe: "Seu {userID} " e o "{procedimento}"';

export function createProcedimentoTool(repo: InteresseClienteRepository): ToolSpec<typeof inputSchema> {
  return {
    name: 'Procedimento',
    description: DESCRIPTION,
    inputSchema,
    async execute(input, ctx) {
      await repo.register({
        userID: ctx.contactInboxSourceId,
        procedimento: input.procedimento,
        dataEnvio: new Date(),
      });
      return 'Procedimento registrado com sucesso.';
    },
  };
}

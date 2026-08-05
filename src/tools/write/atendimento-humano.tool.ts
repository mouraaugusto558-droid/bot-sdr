import { z } from 'zod';
import type { AtendimentoHumanoRepository } from '../../repositories/atendimento-humano.repository.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Equivalente ao node "AtendimentoHumano" (`n8n-nodes-base.supabaseTool` → `atendimento_humano`).
 * Todos os 3 campos vêm do contexto (nenhum `$fromAI` no node original) — o LLM só decide
 * QUANDO chamar, sem fornecer nenhum parâmetro. Ver docs/reverse-engineering.md, Seção 7.
 */
const inputSchema = z.object({});

const DESCRIPTION = 'Acione essa ferramenta quando o cliente perguntar o preço de qualquer procedimento';

export function createAtendimentoHumanoTool(repo: AtendimentoHumanoRepository): ToolSpec<typeof inputSchema> {
  return {
    name: 'AtendimentoHumano',
    description: DESCRIPTION,
    inputSchema,
    async execute(_input, ctx) {
      await repo.register({
        telefone: ctx.contactInboxSourceId,
        nome: ctx.senderName,
        dataEnvio: new Date(),
      });
      return 'Atendimento humano acionado com sucesso.';
    },
  };
}

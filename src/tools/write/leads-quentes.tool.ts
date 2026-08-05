import { z } from 'zod';
import type { LeadsQuentesRepository } from '../../repositories/leads-quentes.repository.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Equivalente ao node "leadsQuentes" (`n8n-nodes-base.supabaseTool` → `leads_quentes`).
 * Todos os 3 campos vêm do contexto (nenhum `$fromAI` no node original) — o LLM só decide
 * QUANDO chamar, sem fornecer nenhum parâmetro. Ver docs/reverse-engineering.md, Seção 7.
 */
const inputSchema = z.object({});

const DESCRIPTION =
  'Use esta ferramenta somente para registrar leads quentes, ou seja, aqueles que demonstrem interesse claro, intenção de agendamento/compra e mereçam atenção prioritária da equipe humana';

export function createLeadsQuentesTool(repo: LeadsQuentesRepository): ToolSpec<typeof inputSchema> {
  return {
    name: 'leadsQuentes',
    description: DESCRIPTION,
    inputSchema,
    async execute(_input, ctx) {
      await repo.register({
        nome: ctx.senderName,
        numero: ctx.contactInboxSourceId,
        criadoEm: new Date(),
      });
      return 'Lead quente registrado com sucesso.';
    },
  };
}

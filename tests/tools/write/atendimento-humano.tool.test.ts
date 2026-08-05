import { describe, expect, it, vi } from 'vitest';
import { createAtendimentoHumanoTool } from '../../../src/tools/write/atendimento-humano.tool.js';
import type { AtendimentoHumanoRepository } from '../../../src/repositories/atendimento-humano.repository.js';
import type { ToolExecutionContext } from '../../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

describe('createAtendimentoHumanoTool', () => {
  it('grava telefone/nome/dataEnvio inteiramente do contexto, sem nenhum campo do LLM', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const repo: AtendimentoHumanoRepository = { register };
    const tool = createAtendimentoHumanoTool(repo);

    const result = await tool.execute({}, ctx);

    expect(register).toHaveBeenCalledWith({
      telefone: 'contact-inbox-123',
      nome: 'Fulano',
      dataEnvio: expect.any(Date),
    });
    expect(result).toBe('Atendimento humano acionado com sucesso.');
  });

  it('não exige nenhum parâmetro de input (schema vazio)', () => {
    const tool = createAtendimentoHumanoTool({ register: vi.fn() });
    expect(tool.inputSchema.safeParse({}).success).toBe(true);
  });
});

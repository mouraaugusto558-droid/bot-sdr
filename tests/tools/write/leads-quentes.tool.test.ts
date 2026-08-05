import { describe, expect, it, vi } from 'vitest';
import { createLeadsQuentesTool } from '../../../src/tools/write/leads-quentes.tool.js';
import type { LeadsQuentesRepository } from '../../../src/repositories/leads-quentes.repository.js';
import type { ToolExecutionContext } from '../../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

describe('createLeadsQuentesTool', () => {
  it('grava nome/numero/criadoEm inteiramente do contexto, sem nenhum campo do LLM', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const repo: LeadsQuentesRepository = { register };
    const tool = createLeadsQuentesTool(repo);

    const result = await tool.execute({}, ctx);

    expect(register).toHaveBeenCalledWith({
      nome: 'Fulano',
      numero: 'contact-inbox-123',
      criadoEm: expect.any(Date),
    });
    expect(result).toBe('Lead quente registrado com sucesso.');
  });

  it('não exige nenhum parâmetro de input (schema vazio)', () => {
    const tool = createLeadsQuentesTool({ register: vi.fn() });
    expect(tool.inputSchema.safeParse({}).success).toBe(true);
  });
});

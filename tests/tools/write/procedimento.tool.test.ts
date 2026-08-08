import { describe, expect, it, vi } from 'vitest';
import { createProcedimentoTool } from '../../../src/tools/write/procedimento.tool.js';
import type { InteresseClienteRepository } from '../../../src/repositories/interesse-cliente.repository.js';
import type { ToolExecutionContext } from '../../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

describe('createProcedimentoTool', () => {
  it('grava userID (contactInboxSourceId) e procedimento (do LLM), com Data_envio do contexto', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const repo: InteresseClienteRepository = { register };
    const tool = createProcedimentoTool(repo);

    const result = await tool.execute({ procedimento: 'implante dentário' }, ctx);

    expect(register).toHaveBeenCalledWith({
      userID: 'contact-inbox-123',
      procedimento: 'implante dentário',
      dataEnvio: expect.any(Date),
    });
    expect(result).toBe('Procedimento registrado com sucesso.');
  });

  it('nome da tool é "Procedimento", igual ao grafo original', () => {
    const tool = createProcedimentoTool({ register: vi.fn() });
    expect(tool.name).toBe('Procedimento');
  });
});

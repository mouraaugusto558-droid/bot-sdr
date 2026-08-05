import { describe, expect, it, vi } from 'vitest';
import { createAnotarTool } from '../../../src/tools/write/anotar.tool.js';
import type { PreAgendamentosRepository } from '../../../src/repositories/pre-agendamentos.repository.js';
import type { ToolExecutionContext } from '../../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

describe('createAnotarTool', () => {
  it('grava userID do contexto e nomeCompleto/periodoDoDia vindos do LLM', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const repo: PreAgendamentosRepository = { exists: vi.fn(), register };
    const tool = createAnotarTool(repo);

    const result = await tool.execute({ nomeCompleto: 'Fulano de Tal', periodoDoDia: 'manhã' }, ctx);

    expect(register).toHaveBeenCalledWith({
      userID: 'contact-inbox-123',
      nomeCompleto: 'Fulano de Tal',
      periodoDoDia: 'manhã',
      dataEnvio: expect.any(Date),
    });
    expect(result).toBe('Pré-agendamento registrado com sucesso.');
  });

  it('nome da tool é "Anotar", igual ao grafo original', () => {
    const tool = createAnotarTool({ exists: vi.fn(), register: vi.fn() });
    expect(tool.name).toBe('Anotar');
  });
});

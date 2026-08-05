import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLangGraphTool, type ToolExecutionContext, type ToolSpec } from '../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

const schema = z.object({ value: z.string() });

describe('createLangGraphTool', () => {
  it('executa a tool com sucesso repassando input e contexto', async () => {
    const execute = vi.fn().mockResolvedValue('ok');
    const spec: ToolSpec<typeof schema> = { name: 'minhaTool', description: 'desc', inputSchema: schema, execute };

    const langChainTool = createLangGraphTool(spec, ctx);
    const result = await langChainTool.invoke({ value: 'abc' });

    expect(result).toBe('ok');
    expect(execute).toHaveBeenCalledWith({ value: 'abc' }, ctx);
  });

  it('tenta novamente em caso de falha transitória e retorna sucesso ao convergir', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout transitório'))
      .mockResolvedValueOnce('sucesso na 2ª tentativa');
    const spec: ToolSpec<typeof schema> = { name: 'minhaTool', description: 'desc', inputSchema: schema, execute };

    const langChainTool = createLangGraphTool(spec, ctx);
    const result = await langChainTool.invoke({ value: 'abc' });

    expect(result).toBe('sucesso na 2ª tentativa');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('nunca deixa uma falha de tool derrubar o turno — retorna erro estruturado após esgotar tentativas', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('falha permanente'));
    const spec: ToolSpec<typeof schema> = { name: 'minhaTool', description: 'desc', inputSchema: schema, execute };

    const langChainTool = createLangGraphTool(spec, ctx);
    const result = await langChainTool.invoke({ value: 'abc' });

    expect(result).toContain('Erro ao executar a ferramenta minhaTool');
    expect(result).toContain('falha permanente');
  });
});

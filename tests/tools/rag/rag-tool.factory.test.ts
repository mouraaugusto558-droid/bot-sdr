import { describe, expect, it, vi } from 'vitest';
import { createRagToolSpec, type RagToolDeps } from '../../../src/tools/rag/rag-tool.factory.js';
import type { ToolExecutionContext } from '../../../src/tools/tool-registry.js';

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

function createDeps(matches: Array<{ text: string; score: number | undefined }>): RagToolDeps {
  return {
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    queryIndex: vi.fn().mockResolvedValue(matches),
  };
}

describe('createRagToolSpec', () => {
  it('embeda a query e busca no índice configurado, concatenando os textos encontrados', async () => {
    const deps = createDeps([
      { text: 'trecho A', score: 0.9 },
      { text: 'trecho B', score: 0.8 },
    ]);
    const spec = createRagToolSpec({ graphName: 'pergunta', description: 'desc', indexName: 'nandafaq1' }, deps);

    const result = await spec.execute({ query: 'quanto custa?' }, ctx);

    expect(deps.embedQuery).toHaveBeenCalledWith('quanto custa?');
    expect(deps.queryIndex).toHaveBeenCalledWith('nandafaq1', [0.1, 0.2, 0.3], 4);
    expect(result).toBe('trecho A\n\n---\n\ntrecho B');
  });

  it('respeita o topK customizado', async () => {
    const deps = createDeps([]);
    const spec = createRagToolSpec(
      { graphName: 'pergunta', description: 'desc', indexName: 'nandafaq1', topK: 10 },
      deps,
    );

    await spec.execute({ query: 'x' }, ctx);

    expect(deps.queryIndex).toHaveBeenCalledWith('nandafaq1', expect.any(Array), 10);
  });

  it('retorna mensagem padrão quando nenhum resultado é encontrado', async () => {
    const deps = createDeps([]);
    const spec = createRagToolSpec({ graphName: 'pergunta', description: 'desc', indexName: 'nandafaq1' }, deps);

    const result = await spec.execute({ query: 'x' }, ctx);

    expect(result).toBe('Nenhum resultado encontrado na base de conhecimento.');
  });

  it('usa o graphName e description informados como nome/descrição da tool', () => {
    const deps = createDeps([]);
    const spec = createRagToolSpec(
      { graphName: 'faqProcedimentosOdonto', description: 'descrição customizada', indexName: 'nandafaq3' },
      deps,
    );

    expect(spec.name).toBe('faqProcedimentosOdonto');
    expect(spec.description).toBe('descrição customizada');
  });
});

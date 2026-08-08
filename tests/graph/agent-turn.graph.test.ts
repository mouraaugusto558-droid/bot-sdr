import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { ToolExecutionContext } from '../../src/tools/tool-registry.js';

const reactAgentInvokeMock = vi.fn();
const structuredOutputInvokeMock = vi.fn();

vi.mock('../../src/config/env.js', () => ({
  loadEnv: () => ({ OPENAI_API_KEY: 'test-key' }),
}));

vi.mock('langchain', () => ({
  createAgent: vi.fn(() => ({ invoke: reactAgentInvokeMock })),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(function ChatOpenAI() {
    return { withStructuredOutput: vi.fn(() => ({ invoke: structuredOutputInvokeMock })) };
  }),
}));

const { runAgentTurnGraph } = await import('../../src/graph/agent-turn.graph.js');

const ctx: ToolExecutionContext = {
  conversationId: '1',
  accountId: '1',
  senderId: '5581999998888',
  contactInboxSourceId: 'contact-inbox-123',
  senderName: 'Fulano',
};

describe('runAgentTurnGraph', () => {
  beforeEach(() => {
    reactAgentInvokeMock.mockReset();
    structuredOutputInvokeMock.mockReset();
  });

  it('injeta o histórico + mensagem atual no agente e propaga o resultado do format-split', async () => {
    const history = [new HumanMessage('mensagem antiga'), new AIMessage('resposta antiga')];

    reactAgentInvokeMock.mockImplementation(
      async ({ messages }: { messages: (HumanMessage | AIMessage)[] }) => ({
        messages: [...messages, new AIMessage('resposta nova do agente')],
      }),
    );
    structuredOutputInvokeMock.mockResolvedValue({ messages: ['parte 1', 'parte 2'] });

    const result = await runAgentTurnGraph({
      text: 'mensagem nova do cliente',
      history,
      toolSpecs: [],
      ctx,
    });

    expect(result.splitMessages).toEqual(['parte 1', 'parte 2']);
    expect(result.updatedHistory).toHaveLength(4);
    expect(result.updatedHistory[0]?.content).toBe('mensagem antiga');
    expect(result.updatedHistory[1]?.content).toBe('resposta antiga');
    expect(result.updatedHistory[2]?.content).toBe('mensagem nova do cliente');
    expect(result.updatedHistory[3]?.content).toBe('resposta nova do agente');
  });

  it('repassa para o format-split o texto da última mensagem do agente', async () => {
    reactAgentInvokeMock.mockImplementation(
      async ({ messages }: { messages: (HumanMessage | AIMessage)[] }) => ({
        messages: [...messages, new AIMessage('resposta única')],
      }),
    );
    structuredOutputInvokeMock.mockResolvedValue({ messages: ['resposta única'] });

    await runAgentTurnGraph({ text: 'oi', history: [], toolSpecs: [], ctx });

    const callArgs = structuredOutputInvokeMock.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    const userTurn = callArgs.find((m) => m.role === 'user');
    expect(userTurn?.content).toBe('resposta única');
  });
});

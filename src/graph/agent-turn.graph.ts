import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { AGENT_MODEL } from '../config/models.js';
import { getSystemPrompt } from '../prompt/prompt-registry.js';
import { createLangGraphTool, type ToolExecutionContext, type ToolSpec } from '../tools/tool-registry.js';
import type { TraceCallbackHandler } from '../observability/trace-callback-handler.js';
import { AgentTurnAnnotation } from './state.js';
import { formatSplitNode } from './nodes/format-split.node.js';

/**
 * Único módulo que importa `@langchain/langgraph`/`langchain` — orquestra só o raciocínio
 * do turno (loop agente↔tools + format/split terminal). Nenhuma leitura/escrita de
 * Redis/Postgres/Chatwoot acontece aqui (plano, Seção 0 e Seção 3): histórico de conversa
 * entra via `history` (lido pelo módulo de Memória — M8 — antes desta chamada) e o
 * resultado sai para quem invocou persistir/entregar (M8/M9), nunca dentro do grafo.
 *
 * Checkpointer: `MemorySaver` efêmero, com `thread_id` novo a cada turno — só satisfaz o
 * requisito interno do LangGraph para grafos com loop agente↔tools; não é o mecanismo de
 * memória entre turnos (esse é o módulo de Memória).
 */
export interface RunAgentTurnGraphInput {
  text: string;
  history: BaseMessage[];
  toolSpecs: ToolSpec<z.ZodObject>[];
  ctx: ToolExecutionContext;
  /** Handler de trace (observability/trace-callback-handler.ts) — opcional, captura chamadas de modelo/tool do turno. */
  trace?: TraceCallbackHandler;
}

export interface RunAgentTurnGraphResult {
  /** Mensagens já divididas pelo nó format-split (equivalente ao array final da Parser Chain). */
  splitMessages: string[];
  /** Histórico completo (entrada + turno atual) para o módulo de Memória persistir. */
  updatedHistory: BaseMessage[];
}

export async function runAgentTurnGraph(input: RunAgentTurnGraphInput): Promise<RunAgentTurnGraphResult> {
  const env = loadEnv();
  const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: AGENT_MODEL.model,
    ...(AGENT_MODEL.temperature !== undefined ? { temperature: AGENT_MODEL.temperature } : {}),
    ...(AGENT_MODEL.topP !== undefined ? { topP: AGENT_MODEL.topP } : {}),
    ...(AGENT_MODEL.frequencyPenalty !== undefined ? { frequencyPenalty: AGENT_MODEL.frequencyPenalty } : {}),
    ...(AGENT_MODEL.reasoningEffort !== undefined ? { reasoning: { effort: AGENT_MODEL.reasoningEffort } } : {}),
  });

  const tools = input.toolSpecs.map((spec) => createLangGraphTool(spec, input.ctx));

  const reactAgent = createAgent({
    model,
    tools,
    systemPrompt: getSystemPrompt(),
  });

  const graph = new StateGraph(AgentTurnAnnotation)
    .addNode('agent', async (state, config?: RunnableConfig) => {
      const result = await reactAgent.invoke(
        { messages: state.messages },
        { ...config, metadata: { ...config?.metadata, modelKey: 'agent' } },
      );
      return { messages: result.messages };
    })
    .addNode('formatSplit', formatSplitNode)
    .addEdge(START, 'agent')
    .addEdge('agent', 'formatSplit')
    .addEdge('formatSplit', END)
    .compile({ checkpointer: new MemorySaver() });

  const threadId = crypto.randomUUID();
  const finalState = await graph.invoke(
    { messages: [...input.history, new HumanMessage(input.text)] },
    {
      configurable: { thread_id: threadId },
      ...(input.trace ? { callbacks: [input.trace] } : {}),
    },
  );

  return {
    splitMessages: finalState.splitMessages,
    updatedHistory: finalState.messages,
  };
}

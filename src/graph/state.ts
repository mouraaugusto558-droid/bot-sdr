import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * Estado do turno do agente: histórico de mensagens (LangChain `BaseMessage[]`, injetado
 * pelo módulo de Memória — M8 — antes de `graph.invoke()`) + as mensagens já divididas pelo
 * nó terminal "format-split" (equivalente à Parser Chain original, Seção 10).
 */
export const AgentTurnAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  splitMessages: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
});

export type AgentTurnState = typeof AgentTurnAnnotation.State;

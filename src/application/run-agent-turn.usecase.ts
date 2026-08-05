import { sendTextMessage } from '../adapters/chatwoot.adapter.js';

export interface AgentTurnInput {
  conversationId: string;
  senderId: string;
  accountId: string;
  text: string;
}

/**
 * STUB (M3): prova o pipeline buffer -> debounce -> "turno do agente" -> entrega.
 * Substituído pelo grafo LangGraph real (carregar memória -> graph.invoke -> persistir
 * memória/trace) em M7-M9.
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<void> {
  await sendTextMessage(input.conversationId, `[stub] você disse: ${input.text}`);
}

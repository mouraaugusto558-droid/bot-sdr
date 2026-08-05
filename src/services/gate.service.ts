/**
 * Lógica de decisão pura dos gates do pipeline. Sem I/O — recebe os fatos já apurados
 * (por repositórios) e devolve uma decisão. Ver docs/reverse-engineering.md, Seções 3 e 4.
 */

export type Switch1Route = 'ai-disabled' | 'follow-flow' | 'ignored-agent-message' | 'no-match';

/** Equivalente ao node "Switch1" original. */
export function decideSwitch1Route(input: {
  labels: readonly unknown[];
  senderType: string | null;
}): Switch1Route {
  if (input.labels.length > 0) return 'ai-disabled';
  if (input.senderType === 'Contact') return 'follow-flow';
  if (input.senderType === 'User') return 'ignored-agent-message';
  return 'no-match';
}

/**
 * Regra confirmada com o usuário (ver plano de implementação, Contexto): uma vez que o
 * cliente já tem pré-agendamento salvo, a Nanda para de responder para sempre — mesmo
 * divergindo do "Modo Suporte" descrito no system prompt original. Reproduzir fielmente.
 */
export function shouldStaySilentForever(hasExistingPreAgendamento: boolean): boolean {
  return hasExistingPreAgendamento;
}

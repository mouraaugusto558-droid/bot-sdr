/**
 * Configuração centralizada de todos os modelos de IA usados pela Nanda.
 * Fonte de verdade dos parâmetros originais: docs/reverse-engineering.md, Seções 7, 10, 11.
 *
 * Cada modelo pode ser trocado só via variável de ambiente, sem tocar em código —
 * este é o único arquivo que precisa ser lido/editado para mudar de modelo/provedor no futuro.
 */

/** Valores válidos para `reasoning.effort` na API da OpenAI (modelos gpt-5.x/o-series). */
type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

function envStr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function envStrOptional(name: string): string | undefined {
  return process.env[name];
}

function envNumOptional(name: string): number | undefined {
  const raw = process.env[name];
  return raw !== undefined ? Number(raw) : undefined;
}

/**
 * Modelo principal do agente de raciocínio (equivalente ao "AI Agent" / OpenAI Chat Model6).
 * temperature/topP/frequencyPenalty/reasoningEffort são todos opcionais: só são enviados à API
 * se a env var correspondente estiver definida — sem env, o parâmetro não é enviado (em vez de
 * cair num default hardcoded), já que alguns modelos/gateways (ex.: modelos "gpt-5.x" via
 * /v1/chat/completions) rejeitam combinações como reasoning_effort + function tools.
 */
export const AGENT_MODEL = {
  model: envStr('AGENT_MODEL', 'gpt-4o'),
  temperature: envNumOptional('AGENT_MODEL_TEMPERATURE'),
  topP: envNumOptional('AGENT_MODEL_TOP_P'),
  frequencyPenalty: envNumOptional('AGENT_MODEL_FREQUENCY_PENALTY'),
  reasoningEffort: envStrOptional('AGENT_MODEL_REASONING_EFFORT') as ReasoningEffort | undefined,
} as const;

/** Modelo do formatador/splitter de mensagens (equivalente à "Parser Chain" / OpenAI3). */
export const PARSER_CHAIN_MODEL = {
  model: envStr('PARSER_CHAIN_MODEL', 'gpt-4.1-mini'),
} as const;

/**
 * Modelo de embeddings usado para os 4 índices Pinecone de RAG.
 * ATENÇÃO: precisa bater com a dimensão dos índices nandafaq1-4 já existentes
 * (ver item de verificação na Seção 1 do reverse-engineering.md antes de trocar).
 */
export const EMBEDDINGS_MODEL = {
  model: envStr('EMBEDDINGS_MODEL', 'text-embedding-3-small'),
} as const;

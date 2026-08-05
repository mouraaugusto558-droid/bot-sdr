/**
 * Configuração centralizada de todos os modelos de IA usados pela Nanda.
 * Fonte de verdade dos parâmetros originais: docs/reverse-engineering.md, Seções 7, 10, 11.
 *
 * Cada modelo pode ser trocado só via variável de ambiente, sem tocar em código —
 * este é o único arquivo que precisa ser lido/editado para mudar de modelo/provedor no futuro.
 */

function envStr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw !== undefined ? Number(raw) : fallback;
}

/** Modelo principal do agente de raciocínio (equivalente ao "AI Agent" / OpenAI Chat Model6). */
export const AGENT_MODEL = {
  model: envStr('AGENT_MODEL', 'gpt-4o'),
  temperature: envNum('AGENT_MODEL_TEMPERATURE', 0.8),
  topP: envNum('AGENT_MODEL_TOP_P', 0.9),
  frequencyPenalty: envNum('AGENT_MODEL_FREQUENCY_PENALTY', 0.3),
} as const;

/** Modelo do formatador/splitter de mensagens (equivalente à "Parser Chain" / OpenAI3). */
export const PARSER_CHAIN_MODEL = {
  model: envStr('PARSER_CHAIN_MODEL', 'gpt-4.1-mini'),
} as const;

/** Modelo de visão computacional (equivalente ao node "OpenAI" de análise de imagem). */
export const VISION_MODEL = {
  model: envStr('VISION_MODEL', 'gpt-4o-mini'),
  fixedPrompt: 'Descreva essa imagem, oque tem nela?',
} as const;

/** Modelo de transcrição de áudio (equivalente ao node "Transcrição"). */
export const TRANSCRIPTION_MODEL = {
  model: envStr('TRANSCRIPTION_MODEL', 'whisper-1'),
  language: envStr('TRANSCRIPTION_LANGUAGE', 'pt'),
} as const;

/**
 * Modelo de embeddings usado para os 4 índices Pinecone de RAG.
 * ATENÇÃO: precisa bater com a dimensão dos índices nandafaq1-4 já existentes
 * (ver item de verificação na Seção 1 do reverse-engineering.md antes de trocar).
 */
export const EMBEDDINGS_MODEL = {
  model: envStr('EMBEDDINGS_MODEL', 'text-embedding-3-small'),
} as const;

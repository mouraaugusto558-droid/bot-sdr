/**
 * Catálogo de constantes de timing/limites extraídas do workflow n8n original.
 * Ver docs/reverse-engineering.md, Seção 11, para a origem de cada valor.
 * Todas sobrescrevíveis via env para permitir testes com janelas curtas.
 *
 * Configuração de modelos de IA (AGENT_MODEL, PARSER_CHAIN_MODEL, etc.) vive em ./models.ts —
 * mantida em arquivo separado para deixar claro que é o ponto único de troca de modelo/provedor.
 */

function envMs(name: string, fallbackMs: number): number {
  const raw = process.env[name];
  return raw !== undefined ? Number(raw) : fallbackMs;
}

/**
 * Timezone usado para preencher "Data/hora atual" no prompt (equivalente ao `$now` do n8n).
 * O export original não especifica timezone no nível do workflow — assume-se o timezone da
 * instância n8n, não capturado no export. Recife/PE (contexto do prompt) está em UTC-3 o ano
 * todo (sem DST no Brasil) — America/Sao_Paulo tem o mesmo offset e é o fallback mais comum
 * em instâncias n8n brasileiras. **Verificar** contra o timezone real da instância n8n original.
 */
export const TIMEZONE = process.env.TIMEZONE ?? 'America/Sao_Paulo';

export const DEBOUNCE_WINDOW_MS = envMs('DEBOUNCE_WINDOW_MS', 20_000);

export const SPLIT_MAX_CHARS_PER_MESSAGE = envMs('SPLIT_MAX_CHARS_PER_MESSAGE', 300);

/** topK das 4 tools RAG (equivalente ao default do node "Vector Store Tool" do n8n). */
export const RAG_TOP_K = envMs('RAG_TOP_K', 4);

/** Tentativas de retry para falhas transitórias de tool (docs/reverse-engineering.md, plano Seção 4). */
export const TOOL_MAX_ATTEMPTS = envMs('TOOL_MAX_ATTEMPTS', 3);
export const TOOL_RETRY_BASE_DELAY_MS = envMs('TOOL_RETRY_BASE_DELAY_MS', 300);

export { AGENT_MODEL, PARSER_CHAIN_MODEL, EMBEDDINGS_MODEL } from './models.js';

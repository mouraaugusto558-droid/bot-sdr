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

export const DEBOUNCE_WINDOW_MS = envMs('DEBOUNCE_WINDOW_MS', 20_000);

export const AUDIO_MIN_TOTAL_CHARS = envMs('AUDIO_MIN_TOTAL_CHARS', 350);
export const SPLIT_MAX_CHARS_PER_MESSAGE = envMs('SPLIT_MAX_CHARS_PER_MESSAGE', 300);

export const DELIVERY_WAIT_AUDIO_MS = envMs('DELIVERY_WAIT_AUDIO_MS', 15_000);
export const DELIVERY_WAIT_TEXT_MS = envMs('DELIVERY_WAIT_TEXT_MS', 8_000);
export const DELIVERY_WAIT_IMAGE_MS = envMs('DELIVERY_WAIT_IMAGE_MS', 8_000);

export {
  AGENT_MODEL,
  PARSER_CHAIN_MODEL,
  VISION_MODEL,
  TRANSCRIPTION_MODEL,
  EMBEDDINGS_MODEL,
  ELEVENLABS_MODEL,
} from './models.js';

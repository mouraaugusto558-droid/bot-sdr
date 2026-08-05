import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIMEZONE } from '../config/constants.js';
import { formatAsN8nNow } from './now-formatter.js';

/**
 * Prompt Engine: fonte única dos prompts usados pelo agente — carregados verbatim dos
 * arquivos em docs/ (extraídos literalmente do export n8n original, ver docs/reverse-engineering.md
 * Seção 7). Nenhum outro módulo deve conter prompt hardcoded — sempre importar daqui.
 */
const DOCS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');

function loadDoc(filename: string): string {
  return readFileSync(path.join(DOCS_DIR, filename), 'utf-8');
}

const SYSTEM_PROMPT_TEMPLATE = loadDoc('system-prompt-original.md');
const PARSER_CHAIN_PROMPT = loadDoc('parser-chain-prompt.md');

const NOW_PLACEHOLDER = '{{ $now.toString() }}';

/** Prompt do agente principal, com "Data/hora atual" substituído pelo instante fornecido (default: agora). */
export function getSystemPrompt(now: Date = new Date()): string {
  return SYSTEM_PROMPT_TEMPLATE.replace(NOW_PLACEHOLDER, formatAsN8nNow(now, TIMEZONE));
}

/** Prompt fixo da "Parser Chain" (formatação/split da resposta final) — sem placeholders. */
export function getParserChainPrompt(): string {
  return PARSER_CHAIN_PROMPT;
}

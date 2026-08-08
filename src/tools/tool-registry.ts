import { tool } from '@langchain/core/tools';
import type { z } from 'zod';
import { TOOL_MAX_ATTEMPTS, TOOL_RETRY_BASE_DELAY_MS } from '../config/constants.js';
import { logger } from '../shared/logger.js';

/**
 * Dados do turno/conversa atual, disponíveis para as tools mas nunca fornecidos pelo LLM
 * (equivalente aos valores lidos de `Webhook1`/`Normalização` nos nós Supabase originais,
 * em vez de `$fromAI`). Ver docs/reverse-engineering.md, Seção 7.
 */
export interface ToolExecutionContext {
  conversationId: string;
  accountId: string;
  senderId: string;
  /** `contact_inbox.source_id` — identificador real usado nas tabelas Supabase (não confundir com senderId/sourceId). */
  contactInboxSourceId: string;
  senderName: string | null;
}

export interface ToolSpec<TSchema extends z.ZodObject> {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute(input: z.infer<TSchema>, ctx: ToolExecutionContext): Promise<string>;
}

async function withRetry<T>(fn: () => Promise<T>, toolName: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TOOL_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn({ toolName, attempt, error }, 'Falha ao executar tool — tentando novamente se possível');
      if (attempt < TOOL_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, TOOL_RETRY_BASE_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Empacota um `ToolSpec` como tool LangChain vinculada ao contexto desta conversa/turno.
 * Retry/backoff limitado para erros transitórios; uma falha de tool nunca derruba o turno
 * inteiro — vira um erro estruturado devolvido ao próprio modelo (equivalente à tolerância
 * `continueRegularOutput` dos nós n8n originais).
 */
export function createLangGraphTool<TSchema extends z.ZodObject>(
  spec: ToolSpec<TSchema>,
  ctx: ToolExecutionContext,
) {
  return tool(
    async (input: z.infer<TSchema>) => {
      try {
        return await withRetry(() => spec.execute(input, ctx), spec.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ toolName: spec.name, error }, 'Tool falhou após esgotar tentativas');
        return `Erro ao executar a ferramenta ${spec.name}: ${message}`;
      }
    },
    {
      name: spec.name,
      description: spec.description,
      schema: spec.inputSchema,
    },
  );
}

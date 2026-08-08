import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Tabela NOVA da Nanda 2.0 (não existe no Supabase original) — persistência de trace por
 * turno do agente (observability/, plano Seção "Observabilidade"). Guarda um resumo
 * agregado + os eventos brutos (`events`, formato `TraceEvent[]`) para inspeção detalhada.
 */
export const agentTraces = pgTable('agent_traces', {
  id: serial('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  contactInboxSourceId: text('contact_inbox_source_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  totalInputTokens: integer('total_input_tokens').notNull(),
  totalOutputTokens: integer('total_output_tokens').notNull(),
  estimatedCostUsd: numeric('estimated_cost_usd', { precision: 10, scale: 6 }).notNull(),
  toolCallCount: integer('tool_call_count').notNull(),
  errorCount: integer('error_count').notNull(),
  events: jsonb('events').notNull(),
});

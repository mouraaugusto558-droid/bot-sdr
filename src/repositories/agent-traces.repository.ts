import type { Db } from '../adapters/postgres.adapter.js';
import { agentTraces } from '../adapters/observability.schema.js';
import type { TraceEvent } from '../observability/trace-callback-handler.js';

export interface AgentTraceRecord {
  conversationId: string;
  contactInboxSourceId: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  errorCount: number;
  events: TraceEvent[];
}

export interface AgentTracesRepository {
  record(input: AgentTraceRecord): Promise<void>;
}

export function createAgentTracesRepository(db: Db): AgentTracesRepository {
  return {
    async record(input) {
      await db.insert(agentTraces).values({
        conversationId: input.conversationId,
        contactInboxSourceId: input.contactInboxSourceId,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
        totalInputTokens: input.totalInputTokens,
        totalOutputTokens: input.totalOutputTokens,
        estimatedCostUsd: input.estimatedCostUsd.toFixed(6),
        toolCallCount: input.toolCallCount,
        errorCount: input.errorCount,
        events: input.events,
      });
    },
  };
}

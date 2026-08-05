import { AGENT_MODEL, PARSER_CHAIN_MODEL } from '../config/models.js';
import { estimateCostUsd } from './cost.js';
import type { TraceEvent } from './trace-callback-handler.js';

const MODEL_BY_KEY: Record<string, string> = {
  agent: AGENT_MODEL.model,
  parser: PARSER_CHAIN_MODEL.model,
};

export interface TraceSummary {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  errorCount: number;
}

/** Agrega os eventos brutos do TraceCallbackHandler num resumo pronto para persistir. */
export function summarizeTrace(events: TraceEvent[]): TraceSummary {
  if (events.length === 0) {
    const now = new Date();
    return {
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostUsd: 0,
      toolCallCount: 0,
      errorCount: 0,
    };
  }

  const startedAtMs = Math.min(...events.map((event) => event.startedAt));
  const finishedAtMs = Math.max(...events.map((event) => event.endedAt));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let estimatedCostUsd = 0;
  let toolCallCount = 0;
  let errorCount = 0;

  for (const event of events) {
    if (event.error) errorCount += 1;

    if (event.type === 'tool') {
      toolCallCount += 1;
      continue;
    }

    const inputTokens = event.inputTokens ?? 0;
    const outputTokens = event.outputTokens ?? 0;
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    const model = event.modelKey ? MODEL_BY_KEY[event.modelKey] : undefined;
    if (model) {
      estimatedCostUsd += estimateCostUsd(model, inputTokens, outputTokens);
    }
  }

  return {
    startedAt: new Date(startedAtMs),
    finishedAt: new Date(finishedAtMs),
    durationMs: finishedAtMs - startedAtMs,
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd,
    toolCallCount,
    errorCount,
  };
}

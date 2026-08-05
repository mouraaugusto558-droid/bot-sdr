import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';

/**
 * Trace leve, formato compatível com spans OTel (nome/start/end/atributos) — sem subir
 * coletor/Jaeger agora (plano, Seção 1). Captura toda chamada de modelo e de tool dentro do
 * turno do agente via callback handler do LangChain — não precisa instrumentar cada nó à mão.
 */
export interface TraceEvent {
  type: 'llm' | 'tool';
  name: string;
  /** Chave lógica do modelo (`'agent'`/`'parser'`, ver graph/agent-turn.graph.ts) — usada para mapear ao preço real em observability/cost.ts. */
  modelKey?: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

interface PendingSpan {
  name: string;
  modelKey: string | undefined;
  startedAt: number;
}

interface OpenAiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
}

/** Remove chaves com valor `undefined` — necessário sob `exactOptionalPropertyTypes`. */
function withoutUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}

export class TraceCallbackHandler extends BaseCallbackHandler {
  name = 'nanda-trace-handler';
  readonly events: TraceEvent[] = [];
  private readonly pending = new Map<string, PendingSpan>();

  override handleLLMStart(
    llm: Serialized,
    _prompts: string[],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ): void {
    const modelKey = typeof metadata?.modelKey === 'string' ? metadata.modelKey : undefined;
    this.pending.set(runId, { name: llm.id.at(-1)?.toString() ?? 'llm', modelKey, startedAt: Date.now() });
  }

  override handleLLMEnd(output: LLMResult, runId: string): void {
    const span = this.pending.get(runId);
    if (!span) return;
    this.pending.delete(runId);

    const usage = output.llmOutput?.tokenUsage as OpenAiTokenUsage | undefined;
    const endedAt = Date.now();
    this.events.push(
      withoutUndefined({
        type: 'llm',
        name: span.name,
        modelKey: span.modelKey,
        startedAt: span.startedAt,
        endedAt,
        durationMs: endedAt - span.startedAt,
        inputTokens: usage?.promptTokens,
        outputTokens: usage?.completionTokens,
      }) as TraceEvent,
    );
  }

  override handleLLMError(err: Error, runId: string): void {
    const span = this.pending.get(runId);
    if (!span) return;
    this.pending.delete(runId);

    const endedAt = Date.now();
    this.events.push(
      withoutUndefined({
        type: 'llm',
        name: span.name,
        modelKey: span.modelKey,
        startedAt: span.startedAt,
        endedAt,
        durationMs: endedAt - span.startedAt,
        error: err.message,
      }) as TraceEvent,
    );
  }

  override handleToolStart(tool: Serialized, _input: string, runId: string): void {
    this.pending.set(runId, { name: tool.id.at(-1)?.toString() ?? 'tool', modelKey: undefined, startedAt: Date.now() });
  }

  override handleToolEnd(_output: unknown, runId: string): void {
    const span = this.pending.get(runId);
    if (!span) return;
    this.pending.delete(runId);

    const endedAt = Date.now();
    this.events.push({ type: 'tool', name: span.name, startedAt: span.startedAt, endedAt, durationMs: endedAt - span.startedAt });
  }

  override handleToolError(err: Error, runId: string): void {
    const span = this.pending.get(runId);
    if (!span) return;
    this.pending.delete(runId);

    const endedAt = Date.now();
    this.events.push({
      type: 'tool',
      name: span.name,
      startedAt: span.startedAt,
      endedAt,
      durationMs: endedAt - span.startedAt,
      error: err.message,
    });
  }
}

/**
 * Tabela de preços (USD por 1M tokens) para estimativa de custo por turno. **Aproximação**:
 * preços de API mudam ao longo do tempo — reconferir contra a tabela oficial da OpenAI
 * periodicamente. Não cobre Whisper (cobrado por minuto, não por token).
 */
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING_USD_PER_MILLION_TOKENS: Record<string, ModelPricing> = {
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
}

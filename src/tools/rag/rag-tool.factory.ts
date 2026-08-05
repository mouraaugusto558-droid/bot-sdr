import { z } from 'zod';
import { RAG_TOP_K } from '../../config/constants.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Equivalente ao node "Vector Store Tool" do n8n (embeddings + query Pinecone + retorno dos
 * trechos encontrados para o modelo ler). Ver docs/reverse-engineering.md, Seção 7.
 */
export const ragToolInputSchema = z.object({
  query: z.string().describe('Pergunta ou trecho da mensagem do cliente para buscar na base de conhecimento'),
});

export interface RagMatch {
  text: string;
  score: number | undefined;
}

export interface RagToolDeps {
  embedQuery(text: string): Promise<number[]>;
  queryIndex(indexName: string, vector: number[], topK: number): Promise<RagMatch[]>;
}

export interface RagToolConfig {
  graphName: string;
  description: string;
  indexName: string;
  topK?: number;
}

export function createRagToolSpec(config: RagToolConfig, deps: RagToolDeps): ToolSpec<typeof ragToolInputSchema> {
  return {
    name: config.graphName,
    description: config.description,
    inputSchema: ragToolInputSchema,
    async execute(input) {
      const vector = await deps.embedQuery(input.query);
      const matches = await deps.queryIndex(config.indexName, vector, config.topK ?? RAG_TOP_K);
      if (matches.length === 0) {
        return 'Nenhum resultado encontrado na base de conhecimento.';
      }
      return matches.map((match) => match.text).join('\n\n---\n\n');
    },
  };
}

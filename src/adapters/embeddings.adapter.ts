import { OpenAIEmbeddings } from '@langchain/openai';
import { loadEnv } from '../config/env.js';
import { EMBEDDINGS_MODEL } from '../config/models.js';

/**
 * Equivalente aos 4 nós "Embeddings OpenAI" que alimentam os Pinecone Vector Stores.
 * ATENÇÃO: modelo precisa bater com a dimensão dos índices nandafaq1-4 já existentes —
 * ver item de verificação em config/models.ts / docs/reverse-engineering.md Seção 1.
 */
let embeddings: OpenAIEmbeddings | null = null;

function getEmbeddings(): OpenAIEmbeddings {
  embeddings ??= new OpenAIEmbeddings({ apiKey: loadEnv().OPENAI_API_KEY, model: EMBEDDINGS_MODEL.model });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text);
}

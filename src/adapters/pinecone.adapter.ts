import { Pinecone } from '@pinecone-database/pinecone';
import { loadEnv } from '../config/env.js';
import type { RagMatch } from '../tools/rag/rag-tool.factory.js';

/** Único lugar que fala com o SDK oficial do Pinecone (os 4 índices nandafaq1-4). */
let client: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  client ??= new Pinecone({ apiKey: loadEnv().PINECONE_API_KEY });
  return client;
}

/** `textKey` default do LangChain `PineconeStore` (usado pelo node original) é "text". */
export async function queryPineconeIndex(indexName: string, vector: number[], topK: number): Promise<RagMatch[]> {
  const index = getPineconeClient().index(indexName);
  const response = await index.query({ vector, topK, includeMetadata: true });
  return response.matches.map((match) => ({
    text: typeof match.metadata?.text === 'string' ? match.metadata.text : JSON.stringify(match.metadata ?? {}),
    score: match.score,
  }));
}

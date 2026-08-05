import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),

  OPENAI_API_KEY: z.string().min(1),

  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX_PERGUNTA: z.string().default('nandafaq1'),
  PINECONE_INDEX_PREOCUPACOES: z.string().default('nandafaq2'),
  PINECONE_INDEX_FAQ_PROCEDIMENTOS: z.string().default('nandafaq3'),
  PINECONE_INDEX_DUVIDAS: z.string().default('nandafaq4'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuração de ambiente inválida:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}

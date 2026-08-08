import type { FastifyInstance } from 'fastify';
import { processMessageBodySchema } from '../schemas/process-message.schema.js';
import { processIncomingMessage } from '../../application/process-message.usecase.js';

/**
 * Único endpoint da Nanda 2.0: recebe uma mensagem já resolvida para texto pelo n8n,
 * bufferiza e responde de forma síncrona com as mensagens da Nanda assim que a janela
 * de silêncio (20s) fecha. Sem integração com Chatwoot/ElevenLabs — isso é responsabilidade
 * do n8n (docs/reverse-engineering.md, Seção 8).
 */
export async function processMessageRoute(app: FastifyInstance): Promise<void> {
  app.post('/messages', async (request, reply) => {
    const parsed = processMessageBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ status: 'error', reason: parsed.error.message });
    }
    const result = await processIncomingMessage(parsed.data);
    return reply.status(200).send(result);
  });
}

import type { FastifyInstance } from 'fastify';
import { chatwootWebhookBodySchema } from '../schemas/chatwoot-webhook.schema.js';
import { handleIncomingWebhook } from '../../application/handle-incoming-webhook.usecase.js';

/**
 * Único endpoint da Nanda 2.0: o n8n passa a só receber o webhook do Chatwoot e fazer
 * um HTTP Request para cá (ver plano de implementação, Seção 2). Responde rápido
 * (202/400) — todo o pipeline real roda depois, em worker.
 */
export async function chatwootWebhookRoute(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/chatwoot', async (request, reply) => {
    const parsed = chatwootWebhookBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ status: 'error', reason: parsed.error.message });
    }
    const result = await handleIncomingWebhook(parsed.data);
    return reply.status(202).send(result);
  });
}

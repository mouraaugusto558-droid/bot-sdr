import Fastify from 'fastify';
import { loadEnv } from '../config/env.js';
import { logger } from '../shared/logger.js';
import { chatwootWebhookRoute } from './routes/chatwoot-webhook.route.js';
import { startIncomingMessageWorker } from '../application/process-incoming-message.job.js';
import { startDebounceWorker } from '../application/flush-conversation-buffer.job.js';

export function buildServer() {
  const app = Fastify({ loggerInstance: logger });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(chatwootWebhookRoute);

  return app;
}

async function main() {
  const env = loadEnv();
  const app = buildServer();
  startIncomingMessageWorker();
  startDebounceWorker();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error(err, 'Falha ao iniciar o servidor');
    process.exit(1);
  });
}

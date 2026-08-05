import type { Queue } from 'bullmq';
import { createQueue, createWorker } from '../adapters/queue.adapter.js';
import { getRedisClient } from '../adapters/redis.adapter.js';
import { getDb } from '../adapters/postgres.adapter.js';
import { loadEnv } from '../config/env.js';
import { createLeadsNoturnosRepository } from '../repositories/leads-noturnos.repository.js';
import { createPreAgendamentosRepository } from '../repositories/pre-agendamentos.repository.js';
import { decideSwitch1Route, shouldStaySilentForever } from '../services/gate.service.js';
import { bufferKey, pushToBuffer } from '../buffer/message-buffer.service.js';
import { scheduleDebounce } from '../buffer/debounce.service.js';
import { getDebounceQueue } from './flush-conversation-buffer.job.js';
import type { NormalizedWebhookEvent } from '../domain/normalized-message.js';
import { logger } from '../shared/logger.js';

export const INCOMING_MESSAGE_QUEUE = 'incoming-message';

// Instanciação preguiçosa: evita abrir conexão Redis/Postgres (e exigir env) só por importar este módulo.
let queue: Queue<NormalizedWebhookEvent> | null = null;
function getQueue(): Queue<NormalizedWebhookEvent> {
  queue ??= createQueue<NormalizedWebhookEvent>(INCOMING_MESSAGE_QUEUE);
  return queue;
}

/**
 * jobId = message.id: dedup automático de entregas duplicadas do webhook (ex. retry do
 * n8n) — melhoria interna que só pode evitar duplicidade, nunca causá-la (ver plano, Seção 2).
 */
export async function enqueueIncomingMessage(event: NormalizedWebhookEvent): Promise<void> {
  await getQueue().add('process', event, {
    ...(event.message.id ? { jobId: event.message.id } : {}),
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

/**
 * Gates do pipeline (equivalentes a Switch1 + leads_noturnos + silêncio pós-agendamento,
 * docs/reverse-engineering.md Seções 3-4). Roda antes de qualquer processamento de IA.
 * Retorna false quando o processamento deve parar aqui (sem resposta ao cliente).
 */
async function passesGates(event: NormalizedWebhookEvent): Promise<boolean> {
  const route = decideSwitch1Route({
    labels: event.conversationMeta.labels,
    senderType: event.client.senderType,
  });
  if (route !== 'follow-flow') {
    logger.debug({ route, event }, 'Mensagem não segue o fluxo de IA (Switch1)');
    return false;
  }

  const userId = event.client.contactInboxSourceId;
  if (!userId) {
    logger.warn({ event }, 'Mensagem sem contactInboxSourceId — não é possível checar gates de Supabase');
    return false;
  }

  const db = getDb();
  const leadsNoturnosRepo = createLeadsNoturnosRepository(db);
  const preAgendamentosRepo = createPreAgendamentosRepository(db);

  if (!(await leadsNoturnosRepo.exists(userId))) {
    await leadsNoturnosRepo.register({
      numeroUsuario: userId,
      nomeUsuario: event.client.senderName,
      dataEnvio: new Date(),
    });
  }

  const hasPreAgendamento = await preAgendamentosRepo.exists(userId);
  if (shouldStaySilentForever(hasPreAgendamento)) {
    logger.debug(
      { userId },
      'Cliente já tem pré-agendamento — silêncio total (comportamento reproduzido de propósito)',
    );
    return false;
  }

  return true;
}

/**
 * Worker do "incoming-message": gates -> (M4: dispatch de mídia) -> buffer -> debounce.
 * Não responde diretamente — quem responde é o worker de flush do debounce
 * (application/flush-conversation-buffer.job.ts) quando a janela de silêncio expira.
 */
export function startIncomingMessageWorker() {
  return createWorker<NormalizedWebhookEvent>(INCOMING_MESSAGE_QUEUE, async (job) => {
    const event = job.data;
    const { conversationId, senderId } = event.client;
    if (!conversationId || !senderId) {
      logger.warn({ event }, 'Mensagem sem conversationId/senderId — descartada');
      return;
    }

    if (!(await passesGates(event))) {
      return;
    }

    // TODO (M4): dispatch real de mídia (transcrição/visão/pdf) — por ora usa o texto cru.
    const resolvedText = event.message.content ?? '';
    if (!resolvedText) {
      logger.debug({ event }, 'Mensagem sem conteúdo resolvido — nada para bufferizar');
      return;
    }

    const accountId = loadEnv().CHATWOOT_ACCOUNT_ID;
    const key = bufferKey(accountId, senderId);
    const redis = getRedisClient();

    await pushToBuffer(redis, key, {
      message: resolvedText,
      messageId: event.message.id,
      timestamp: event.message.timestamp ?? new Date().toISOString(),
    });

    await scheduleDebounce(getDebounceQueue(), key, {
      conversationKey: key,
      conversationId,
      senderId,
      accountId,
    });
  });
}

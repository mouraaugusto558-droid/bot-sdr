import { classifyMessages } from '../services/message-classifier.service.js';
import { downloadMedia } from '../adapters/media-download.adapter.js';
import { sendImageMessage, sendTextMessage } from '../adapters/chatwoot.adapter.js';
import { DELIVERY_WAIT_IMAGE_MS, DELIVERY_WAIT_TEXT_MS } from '../config/constants.js';

export interface DeliverReplyDeps {
  downloadMedia(url: string): Promise<Buffer>;
  sendTextMessage(conversationId: string, content: string): Promise<void>;
  sendImageMessage(conversationId: string, image: Blob): Promise<void>;
  sleep(ms: number): Promise<void>;
}

const defaultDeps: DeliverReplyDeps = {
  downloadMedia,
  sendTextMessage,
  sendImageMessage,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Equivalente ao "Loop Over Items" (`splitInBatches`, tamanho 1) + `Switch2` + HTTP Request +
 * `sendChatWoot*` + `Wait*` (docs/reverse-engineering.md, Seção 10) — entrega sequencial, uma
 * mensagem por vez, com espera entre envios (8s texto / 8s imagem).
 *
 * A Nanda 2.0 só entrega texto e imagem — conversão texto→áudio (se necessária) é
 * responsabilidade do próprio n8n, fora do escopo desta API (decisão do usuário).
 */
export async function deliverReply(
  conversationId: string,
  splitMessages: string[],
  deps: DeliverReplyDeps = defaultDeps,
): Promise<void> {
  const classified = classifyMessages(splitMessages);

  for (const item of classified) {
    if (item.sendAs === 'image') {
      const bytes = await deps.downloadMedia(item.message);
      await deps.sendImageMessage(conversationId, new Blob([new Uint8Array(bytes)]));
      await deps.sleep(DELIVERY_WAIT_IMAGE_MS);
    } else {
      await deps.sendTextMessage(conversationId, item.message);
      await deps.sleep(DELIVERY_WAIT_TEXT_MS);
    }
  }
}

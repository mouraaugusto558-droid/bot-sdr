import type { NormalizedIncomingMessage } from '../domain/message.js';

/**
 * Equivalente ao node "Switch" de dispatch por tipo de mídia + "Organiza Texto"
 * (docs/reverse-engineering.md, Seção 5). Ordem das regras confirmada no JSON original
 * (`Switch`, `rules.values`, primeira regra que casar vence — não reordenar):
 *   1. audio  2. image  3. content não vazio (texto puro)  4. pdf  5. fallback "none"
 *
 * Função pura orquestrando dependências injetadas — sem I/O direto, para ser testável
 * sem rede/OpenAI real.
 */
export interface MediaDispatchDeps {
  downloadMedia(url: string): Promise<Buffer>;
  transcribeAudio(audio: Buffer): Promise<string>;
  analyzeImage(imageBase64: string, mimeType: string): Promise<string>;
  extractPdfText(pdf: Buffer): Promise<string>;
  guessImageMimeType(url: string): string;
}

/** Retorna o texto resolvido ("Mídia_Tratada") ou `null` quando nenhuma regra casa (fallback "none", sem saída). */
export async function dispatchMedia(
  message: NormalizedIncomingMessage,
  deps: MediaDispatchDeps,
): Promise<string | null> {
  if (message.type === 'audio') {
    if (!message.contentUrl) return null;
    const audio = await deps.downloadMedia(message.contentUrl);
    return deps.transcribeAudio(audio);
  }

  if (message.type === 'image') {
    if (!message.contentUrl) return null;
    const image = await deps.downloadMedia(message.contentUrl);
    return deps.analyzeImage(image.toString('base64'), deps.guessImageMimeType(message.contentUrl));
  }

  if (message.content) {
    return message.content;
  }

  if (message.type === 'pdf') {
    if (!message.contentUrl) return null;
    const pdf = await deps.downloadMedia(message.contentUrl);
    return deps.extractPdfText(pdf);
  }

  return null;
}

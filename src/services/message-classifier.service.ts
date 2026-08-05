/**
 * Classifica cada mensagem já dividida pelo format-split como imagem ou texto.
 *
 * Deviação deliberada do node "Code in JavaScript" original (docs/reverse-engineering.md,
 * Seção 10): lá, parágrafos elegíveis que somassem >=350 caracteres podiam virar áudio via
 * ElevenLabs. Decisão do usuário: a Nanda 2.0 só responde em texto — conversão texto→áudio
 * (se necessária) fica a cargo do próprio n8n, fora do escopo desta API. Por isso a lógica de
 * elegibilidade/limiar/`cleanForAudio` foi removida; só a detecção de URL de imagem permanece.
 */
export type SendAs = 'text' | 'image';

export interface ClassifiedMessage {
  order: number;
  sendAs: SendAs;
  /** Texto a enviar: URL da imagem (sendAs=image) ou o texto original (sendAs=text). */
  message: string;
}

const IMAGE_EXT_REGEX = /(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic)/i;
const IMAGE_CDN_HOST_REGEX =
  /(cloudinary\.com|imgur\.com|cdn\.|\bres\.cloudinary|amazonaws\.com\/.*\b(img|image|photo)|wp-content\/uploads|googleusercontent\.com)/i;

function extractFirstUrl(text: string): string | null {
  const match = /https?:\/\/[^\s)>\]"']+/i.exec(text);
  return match ? match[0] : null;
}

function getImageUrl(text: string): string | null {
  const trimmed = text.trim();

  const mdMatch = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/i.exec(trimmed);
  if (mdMatch?.[1]) {
    return mdMatch[1];
  }

  const url = extractFirstUrl(trimmed);
  if (!url) return null;

  const cleanUrl = url.replace(/[.,!?;:]+$/, '');

  if (IMAGE_EXT_REGEX.test(cleanUrl) || IMAGE_CDN_HOST_REGEX.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

export function classifyMessages(messages: string[]): ClassifiedMessage[] {
  return messages.map((originalMessage, index) => {
    const imageUrl = getImageUrl(originalMessage);

    return {
      order: index + 1,
      sendAs: imageUrl ? 'image' : 'text',
      message: imageUrl ?? originalMessage,
    };
  });
}

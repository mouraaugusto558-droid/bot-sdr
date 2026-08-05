/**
 * Equivalente aos nós GetMidia/GetMidia1/GetMidia2 (baixam `Message.contentUrl` antes de
 * transcrever/analisar/extrair). Único lugar que baixa bytes de mídia crua.
 */
export async function downloadMedia(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar mídia (${String(response.status)}): ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Melhor esforço a partir da extensão da URL — o original não valida mimetype, apenas repassa a mídia. */
export function guessImageMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  return (extension && EXTENSION_MIME_TYPES[extension]) ?? 'image/jpeg';
}

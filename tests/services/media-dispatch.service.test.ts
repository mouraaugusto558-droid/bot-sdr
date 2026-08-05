import { describe, expect, it, vi } from 'vitest';
import { dispatchMedia, type MediaDispatchDeps } from '../../src/services/media-dispatch.service.js';
import type { NormalizedIncomingMessage } from '../../src/domain/message.js';

function baseMessage(overrides: Partial<NormalizedIncomingMessage> = {}): NormalizedIncomingMessage {
  return {
    id: '1',
    timestamp: '2026-08-04T00:00:00.000Z',
    type: null,
    content: null,
    contentUrl: null,
    ...overrides,
  };
}

function createDeps(): MediaDispatchDeps & {
  downloadMedia: ReturnType<typeof vi.fn>;
  transcribeAudio: ReturnType<typeof vi.fn>;
  analyzeImage: ReturnType<typeof vi.fn>;
  extractPdfText: ReturnType<typeof vi.fn>;
  guessImageMimeType: ReturnType<typeof vi.fn>;
} {
  return {
    downloadMedia: vi.fn().mockResolvedValue(Buffer.from('fake-bytes')),
    transcribeAudio: vi.fn().mockResolvedValue('transcrição do áudio'),
    analyzeImage: vi.fn().mockResolvedValue('descrição da imagem'),
    extractPdfText: vi.fn().mockResolvedValue('texto do pdf'),
    guessImageMimeType: vi.fn().mockReturnValue('image/jpeg'),
  };
}

describe('dispatchMedia', () => {
  it('áudio: baixa e transcreve via Whisper', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'audio', contentUrl: 'https://cdn/audio.ogg' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('transcrição do áudio');
    expect(deps.downloadMedia).toHaveBeenCalledWith('https://cdn/audio.ogg');
    expect(deps.transcribeAudio).toHaveBeenCalledWith(Buffer.from('fake-bytes'));
  });

  it('imagem: baixa e analisa via visão (gpt-4o-mini), convertendo para base64', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'image', contentUrl: 'https://cdn/foto.png' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('descrição da imagem');
    expect(deps.guessImageMimeType).toHaveBeenCalledWith('https://cdn/foto.png');
    expect(deps.analyzeImage).toHaveBeenCalledWith(Buffer.from('fake-bytes').toString('base64'), 'image/jpeg');
  });

  it('texto puro: retorna o content diretamente, sem chamar nenhuma dependência de mídia', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'text', content: 'olá, quero agendar' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('olá, quero agendar');
    expect(deps.downloadMedia).not.toHaveBeenCalled();
  });

  it('pdf: baixa e extrai texto quando content está vazio', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'pdf', contentUrl: 'https://cdn/arquivo.pdf' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('texto do pdf');
    expect(deps.extractPdfText).toHaveBeenCalledWith(Buffer.from('fake-bytes'));
  });

  it('fidelidade à ordem real do Switch: content não vazio vence mesmo quando type é pdf', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'pdf', content: 'legenda do documento', contentUrl: 'https://cdn/arquivo.pdf' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('legenda do documento');
    expect(deps.downloadMedia).not.toHaveBeenCalled();
  });

  it('fidelidade à ordem real do Switch: audio vence mesmo quando content também está preenchido', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'audio', content: 'texto irrelevante', contentUrl: 'https://cdn/audio.ogg' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBe('transcrição do áudio');
  });

  it('nenhuma regra bate (fallback "none"): retorna null sem chamar dependências', async () => {
    const deps = createDeps();
    const message = baseMessage();

    const result = await dispatchMedia(message, deps);

    expect(result).toBeNull();
    expect(deps.downloadMedia).not.toHaveBeenCalled();
  });

  it('áudio sem contentUrl: retorna null sem chamar dependências', async () => {
    const deps = createDeps();
    const message = baseMessage({ type: 'audio' });

    const result = await dispatchMedia(message, deps);

    expect(result).toBeNull();
    expect(deps.downloadMedia).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { guessImageMimeType } from '../../src/adapters/media-download.adapter.js';

describe('guessImageMimeType', () => {
  it('reconhece extensões comuns de imagem', () => {
    expect(guessImageMimeType('https://cdn/foto.jpg')).toBe('image/jpeg');
    expect(guessImageMimeType('https://cdn/foto.jpeg')).toBe('image/jpeg');
    expect(guessImageMimeType('https://cdn/foto.png')).toBe('image/png');
    expect(guessImageMimeType('https://cdn/foto.webp')).toBe('image/webp');
    expect(guessImageMimeType('https://cdn/foto.gif')).toBe('image/gif');
  });

  it('ignora query string ao resolver a extensão', () => {
    expect(guessImageMimeType('https://cdn/foto.png?token=abc')).toBe('image/png');
  });

  it('usa image/jpeg como fallback para extensão desconhecida ou ausente', () => {
    expect(guessImageMimeType('https://cdn/sem-extensao')).toBe('image/jpeg');
    expect(guessImageMimeType('https://cdn/foto.bin')).toBe('image/jpeg');
  });
});

import { describe, expect, it } from 'vitest';
import { classifyMessages } from '../../src/services/message-classifier.service.js';

describe('classifyMessages', () => {
  it('classifica mensagens comuns como texto', () => {
    const result = classifyMessages(['Oi, tudo bem?', 'Como posso ajudar?']);

    expect(result.every((m) => m.sendAs === 'text')).toBe(true);
    expect(result.map((m) => m.message)).toEqual(['Oi, tudo bem?', 'Como posso ajudar?']);
  });

  it('classifica mensagens longas como texto (conversão para áudio não é responsabilidade desta API)', () => {
    const long = 'a'.repeat(400);

    const result = classifyMessages([long]);

    expect(result[0]?.sendAs).toBe('text');
    expect(result[0]?.message).toBe(long);
  });

  it('detecta URL de imagem em markdown e força sendAs=image, retornando a URL', () => {
    const result = classifyMessages(['![foto](https://cdn.example.com/foto.png)']);

    expect(result[0]?.sendAs).toBe('image');
    expect(result[0]?.message).toBe('https://cdn.example.com/foto.png');
  });

  it('detecta URL de imagem por extensão de arquivo mesmo sem markdown', () => {
    const result = classifyMessages(['Veja aqui: https://exemplo.com/imagem.jpg']);

    expect(result[0]?.sendAs).toBe('image');
    expect(result[0]?.message).toBe('https://exemplo.com/imagem.jpg');
  });

  it('detecta URL de imagem por host de CDN conhecido', () => {
    const result = classifyMessages(['https://res.cloudinary.com/algum/caminho/arquivo']);

    expect(result[0]?.sendAs).toBe('image');
  });

  it('não confunde uma URL comum (não imagem) com imagem — classifica como texto', () => {
    const result = classifyMessages(['Acesse www.exemplo.com.br para saber mais']);

    expect(result[0]?.sendAs).toBe('text');
  });

  it('numera "order" a partir de 1, na ordem original', () => {
    const result = classifyMessages(['primeira', 'segunda', 'terceira']);

    expect(result.map((m) => m.order)).toEqual([1, 2, 3]);
  });
});

import { describe, expect, it } from 'vitest';
import { getParserChainPrompt, getSystemPrompt } from '../../src/prompt/prompt-registry.js';
import { TOOL_CATALOG } from '../../src/prompt/tool-catalog.js';

describe('getSystemPrompt', () => {
  it('substitui o placeholder {{ $now.toString() }} pela data/hora fornecida', () => {
    const now = new Date(Date.UTC(2026, 7, 4, 15, 30, 45, 123));

    const prompt = getSystemPrompt(now);

    expect(prompt).not.toContain('{{ $now.toString() }}');
    expect(prompt).toContain('2026-08-04T12:30:45.123-03:00');
  });

  it('preserva o restante do prompt verbatim (âncoras conhecidas do prompt original)', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('Você é Nanda, a assistente de recepção via WhatsApp da Exclusive Odontologia.');
    expect(prompt).toContain('<role>');
    expect(prompt).toContain('<persona>');
  });

  it('teste de drift: todas as 8 tools do catálogo (docs/reverse-engineering.md Seção 7) são referenciadas no prompt', () => {
    const prompt = getSystemPrompt();

    for (const tool of TOOL_CATALOG) {
      expect(prompt, `tool "${tool.graphName}" deveria ser referenciada como "${tool.promptLabel}"`).toContain(
        tool.promptLabel,
      );
    }
  });
});

describe('getParserChainPrompt', () => {
  it('carrega o prompt fixo da Parser Chain verbatim, sem placeholders', () => {
    const prompt = getParserChainPrompt();

    expect(prompt).toContain('splitedMessage');
    expect(prompt).toContain('300 carateres');
    expect(prompt).not.toContain('{{');
  });
});

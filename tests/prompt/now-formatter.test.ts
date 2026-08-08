import { describe, expect, it } from 'vitest';
import { formatAsN8nNow } from '../../src/prompt/now-formatter.js';

describe('formatAsN8nNow', () => {
  it('formata como ISO 8601 com offset, equivalente a Luxon DateTime#toISO() (formato de $now.toString() no n8n)', () => {
    const date = new Date(Date.UTC(2026, 7, 4, 15, 30, 45, 123));

    expect(formatAsN8nNow(date, 'America/Sao_Paulo')).toBe('2026-08-04T12:30:45.123-03:00');
  });

  it('respeita timezones com offset positivo', () => {
    const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));

    expect(formatAsN8nNow(date, 'Europe/Lisbon')).toMatch(/^2026-01-01T00:00:00\.000[+-]\d{2}:\d{2}$/);
  });

  it('sempre inclui milissegundos com 3 dígitos', () => {
    const date = new Date(Date.UTC(2026, 7, 4, 15, 30, 45, 5));

    expect(formatAsN8nNow(date, 'America/Sao_Paulo')).toBe('2026-08-04T12:30:45.005-03:00');
  });
});

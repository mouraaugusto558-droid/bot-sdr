import { describe, expect, it } from 'vitest';
import { decideSwitch1Route, shouldStaySilentForever } from '../../src/services/gate.service.js';

describe('decideSwitch1Route', () => {
  it('desliga a IA quando existe qualquer label na conversa', () => {
    expect(decideSwitch1Route({ labels: ['qualquer-label'], senderType: 'Contact' })).toBe('ai-disabled');
  });

  it('segue o fluxo para mensagens do cliente (Contact) sem labels', () => {
    expect(decideSwitch1Route({ labels: [], senderType: 'Contact' })).toBe('follow-flow');
  });

  it('ignora mensagens enviadas por agente humano (User)', () => {
    expect(decideSwitch1Route({ labels: [], senderType: 'User' })).toBe('ignored-agent-message');
  });

  it('não bate em nenhuma regra para senderType desconhecido', () => {
    expect(decideSwitch1Route({ labels: [], senderType: null })).toBe('no-match');
  });

  it('labels tem prioridade sobre senderType (desliga mesmo para Contact)', () => {
    expect(decideSwitch1Route({ labels: ['x'], senderType: 'User' })).toBe('ai-disabled');
  });
});

describe('shouldStaySilentForever', () => {
  it('fica em silêncio quando já existe pré-agendamento', () => {
    expect(shouldStaySilentForever(true)).toBe(true);
  });

  it('não silencia quando não existe pré-agendamento', () => {
    expect(shouldStaySilentForever(false)).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { deliverReply, type DeliverReplyDeps } from '../../src/application/deliver-reply.usecase.js';

function createDeps(): DeliverReplyDeps {
  return {
    downloadMedia: vi.fn().mockResolvedValue(Buffer.from('imagem')),
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendImageMessage: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
  };
}

describe('deliverReply', () => {
  it('classifica e entrega mensagens de texto simples, esperando 8s entre envios', async () => {
    const deps = createDeps();

    await deliverReply('123', ['Oi, tudo bem?', 'Como posso ajudar?'], deps);

    expect(deps.sendTextMessage).toHaveBeenCalledTimes(2);
    expect(deps.sendTextMessage).toHaveBeenNthCalledWith(1, '123', 'Oi, tudo bem?');
    expect(deps.sendTextMessage).toHaveBeenNthCalledWith(2, '123', 'Como posso ajudar?');
    expect(deps.sleep).toHaveBeenCalledWith(8_000);
    expect(deps.sleep).toHaveBeenCalledTimes(2);
  });

  it('entrega mensagens longas como texto (conversão para áudio fica a cargo do n8n, fora desta API)', async () => {
    const deps = createDeps();
    const longMessage = 'a'.repeat(400);

    await deliverReply('123', [longMessage], deps);

    expect(deps.sendTextMessage).toHaveBeenCalledWith('123', longMessage);
    expect(deps.sleep).toHaveBeenCalledWith(8_000);
  });

  it('baixa e envia imagem, esperando 8s antes do próximo envio', async () => {
    const deps = createDeps();

    await deliverReply('123', ['![foto](https://cdn.example.com/foto.png)'], deps);

    expect(deps.downloadMedia).toHaveBeenCalledWith('https://cdn.example.com/foto.png');
    expect(deps.sendImageMessage).toHaveBeenCalledTimes(1);
    expect(deps.sleep).toHaveBeenCalledWith(8_000);
  });

  it('entrega mensagens mistas na ordem original, cada uma com sua espera correspondente', async () => {
    const deps = createDeps();

    await deliverReply('123', ['![foto](https://cdn.example.com/foto.png)', 'Oi, tudo bem?'], deps);

    expect(deps.sendImageMessage).toHaveBeenCalledTimes(1);
    expect(deps.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(deps.sleep).toHaveBeenNthCalledWith(1, 8_000);
    expect(deps.sleep).toHaveBeenNthCalledWith(2, 8_000);
  });

  it('não envia nada quando a lista de mensagens está vazia', async () => {
    const deps = createDeps();

    await deliverReply('123', [], deps);

    expect(deps.sendTextMessage).not.toHaveBeenCalled();
    expect(deps.sendImageMessage).not.toHaveBeenCalled();
  });
});

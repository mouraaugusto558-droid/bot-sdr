import { loadEnv } from '../config/env.js';

/**
 * Único lugar que fala HTTP com a API do Chatwoot. Endpoint e headers exatamente como
 * documentado em docs/reverse-engineering.md, Seção 10 (nós sendChatWoot/1/2 do original).
 */
function messagesEndpoint(conversationId: string): string {
  const env = loadEnv();
  const base = env.CHATWOOT_BASE_URL.endsWith('/') ? env.CHATWOOT_BASE_URL : `${env.CHATWOOT_BASE_URL}/`;
  return `${base}api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;
}

async function postToChatwoot(conversationId: string, form: FormData): Promise<void> {
  const env = loadEnv();
  const response = await fetch(messagesEndpoint(conversationId), {
    method: 'POST',
    headers: { api_access_token: env.CHATWOOT_API_TOKEN },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Chatwoot respondeu ${response.status} ao enviar mensagem: ${body}`);
  }
}

export async function sendTextMessage(conversationId: string, content: string): Promise<void> {
  const form = new FormData();
  form.append('content', content);
  await postToChatwoot(conversationId, form);
}

export async function sendImageMessage(conversationId: string, image: Blob): Promise<void> {
  const form = new FormData();
  form.append('attachments[]', image);
  form.append('message_type', 'outgoing');
  form.append('file_type', 'data');
  await postToChatwoot(conversationId, form);
}

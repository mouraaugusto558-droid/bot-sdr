import { loadEnv } from '../config/env.js';
import { TRANSCRIPTION_MODEL, VISION_MODEL } from '../config/models.js';

/**
 * Único lugar que fala HTTP com a API da OpenAI para transcrição/visão (equivalentes aos
 * nós "Transcrição" e "OpenAI" de análise de imagem — docs/reverse-engineering.md, Seção 5).
 * `fetch` cru, mesmo padrão de adapters/chatwoot.adapter.ts — sem SDK dedicado para só duas
 * chamadas simples. O modelo do agente (LangGraph, M7) usa @langchain/openai separadamente.
 */
function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${loadEnv().OPENAI_API_KEY}` };
}

export async function transcribeAudio(audio: Buffer, filename = 'audio.ogg'): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)]), filename);
  form.append('model', TRANSCRIPTION_MODEL.model);
  form.append('language', TRANSCRIPTION_MODEL.language);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (!response.ok) {
    throw new Error(`OpenAI Whisper respondeu ${String(response.status)}: ${await response.text()}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}

export async function analyzeImage(imageBase64: string, mimeType: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_MODEL.fixedPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI Vision respondeu ${String(response.status)}: ${await response.text()}`);
  }
  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? '';
}

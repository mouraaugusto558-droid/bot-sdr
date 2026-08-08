// ============================================================================
// Code node - substitui a lógica que dependia do node "Split Out"
// Mode: Run Once for All Items
//
// CAUSA RAIZ DO BUG ORIGINAL:
// O node "Split Out" está configurado com fieldToSplitOut = " output.messages"
// (espaço no início + prefixo "output."), mas o node "TEXT" (Set), que roda
// logo antes, já extrai o array pra um campo TOP-LEVEL chamado só "messages".
// Como o nome não bate, o Split Out não encontra o campo e não separa nada
// -> este Code node recebia 1 item com "messages" sendo um ARRAY de N
// parágrafos, em vez de N items com "messages" sendo 1 STRING cada.
//
// FIX RECOMENDADO NO NODE "Split Out" (resolve na raiz):
//   fieldToSplitOut: "messages"   (sem espaço, sem "output.")
//
// O código abaixo foi reescrito pra funcionar corretamente nos dois cenários
// - Split Out corrigido (1 item = 1 string) OU bug atual (1 item = array de
// strings) - então nada quebra mesmo que o Split Out não seja corrigido.
// ============================================================================

const MIN_TOTAL_CHARS = 350;

// ── EXTRAÇÃO DAS MENSAGENS (sempre retorna um ARRAY de parágrafos) ──
function getMessagesArray(json) {
  const raw =
    json.output?.messages ??
    json.output?.message ??
    json.output?.text ??
    json.output?.content ??
    json['output.messages'] ??
    json[' output.messages'] ??
    json.messages ??
    json.message ??
    json.text ??
    json.content ??
    (typeof json.output === 'string' ? json.output : undefined);

  if (raw === undefined || raw === null) return [];

  // Caso atual (bug do Split Out): array vindo direto do backend/LLM
  if (Array.isArray(raw)) {
    return raw
      .map((m) => (m ?? '').toString().trim())
      .filter((m) => m.length > 0);
  }

  // Caso o Split Out seja corrigido: cada item já chega como 1 string
  const single = raw.toString().trim();
  return single ? [single] : [];
}

function cleanForAudio(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── DETECÇÃO DE IMAGEM ── (mantida igual)
const IMAGE_EXT_REGEX = /(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic)/i;
const IMAGE_CDN_HOST_REGEX = /(cloudinary\.com|imgur\.com|cdn\.|\bres\.cloudinary|amazonaws\.com\/.*\b(img|image|photo)|wp-content\/uploads|googleusercontent\.com)/i;

function extractFirstUrl(text) {
  const match = text.match(/https?:\/\/[^\s)>\]"']+/i);
  return match ? match[0] : null;
}

function getImageUrl(text) {
  const trimmed = text.trim();

  const mdMatch = trimmed.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
  if (mdMatch) {
    return mdMatch[1];
  }

  const url = extractFirstUrl(trimmed);
  if (!url) return null;

  const cleanUrl = url.replace(/[.,!?;:]+$/, '');

  if (IMAGE_EXT_REGEX.test(cleanUrl) || IMAGE_CDN_HOST_REGEX.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

function hasUrl(text) {
  return /https?:\/\/|www\./i.test(text);
}

function hasPhoneNumber(text) {
  return (
    /\+?\d{1,3}\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/.test(text) ||
    /\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/.test(text) ||
    /\b\d{4,5}[-\s]?\d{4}\b/.test(text) ||
    /\b\d{10,13}\b/.test(text)
  );
}

function hasAddress(text) {
  const hasStreetWithNumber = /\b(avenida|av\.?|rua|r\.?|travessa|tv\.?|estrada|rodovia|alameda|praça)\b.{0,100}\b\d{1,6}\b/i.test(text);
  const hardMarkers = ['nº', 'n°', 'cep', 'trade center', 'sala \\d', 'andar \\d'];
  return hasStreetWithNumber || hardMarkers.some((m) => new RegExp(m, 'i').test(text));
}

function hasHumanContact(text) {
  const lower = text.toLowerCase();
  const words = ['whatsapp', 'zap', 'telefone', 'contato', 'atendente', 'atendentes', 'humano', 'humanos', 'falar com', 'chamar no', 'nossa equipe'];
  return words.some((word) => lower.includes(word));
}

function isBlockedForAudio(text) {
  return !text || hasUrl(text) || hasPhoneNumber(text) || hasAddress(text) || hasHumanContact(text);
}

// ── Pré-processamento ──
// Cada item de entrada pode trazer 1 mensagem (string) ou N mensagens (array).
// Aqui "achatamos" tudo em uma lista única de parágrafos, na ordem em que
// chegaram, guardando o json/binary de origem pra reaproveitar campos como
// conversationId, messageId, status etc. no output final.
// Isso elimina o bug de a mesma mensagem inicial ser marcada como áudio E
// texto, e não depende mais do Split Out ter funcionado corretamente.

const flatParagraphs = [];

items.forEach((item, itemIndex) => {
  const paragraphs = getMessagesArray(item.json);
  paragraphs.forEach((message) => {
    flatParagraphs.push({
      sourceJson: item.json,
      sourceBinary: item.binary,
      sourceItemIndex: itemIndex,
      message
    });
  });
});

const processed = flatParagraphs.map((p, index) => {
  const originalMessage = p.message;
  const imageUrl = getImageUrl(originalMessage);
  const cleanedMessage = cleanForAudio(originalMessage);

  let forcedType = null;

  if (imageUrl) {
    forcedType = 'image';
  } else if (isBlockedForAudio(originalMessage)) {
    forcedType = 'blocked';
  }

  return {
    ...p,
    index,
    originalMessage,
    cleanedMessage,
    resolvedMessage: imageUrl || originalMessage,
    chars: cleanedMessage.length,
    forcedType
  };
});

// Só os parágrafos "livres" (sem tipo forçado) disputam a escolha de áudio por tamanho.
const eligibleItems = processed.filter((p) => p.forcedType === null);
const totalEligibleChars = eligibleItems.reduce((sum, p) => sum + p.chars, 0);

let audioIndex = null;
if (totalEligibleChars >= MIN_TOTAL_CHARS && eligibleItems.length > 0) {
  audioIndex = eligibleItems[0].index;
}

return processed.map((p) => {
  let sendAs = 'text';
  let reason = 'default_text';

  if (p.forcedType === 'image') { sendAs = 'image'; reason = 'image_url'; }
  else if (p.forcedType === 'blocked') { sendAs = 'text'; reason = 'blocked_for_audio'; }
  else if (p.index === audioIndex) { sendAs = 'audio'; reason = 'first_eligible_paragraph'; }
  else {
    sendAs = 'text';
    reason = totalEligibleChars < MIN_TOTAL_CHARS ? 'total_too_short' : 'not_selected_for_audio';
  }

  return {
    json: {
      ...p.sourceJson,
      ordem: p.index + 1,
      sendAs,
      type: sendAs,
      messages: sendAs === 'audio' ? p.cleanedMessage : p.resolvedMessage,
      audioReason: reason,
      messageChars: p.chars,
      totalEligibleChars
    },
    binary: p.sourceBinary,
    pairedItem: { item: p.sourceItemIndex }
  };
});

/**
 * Tipo da mensagem recebida. Pode ser qualquer extensão de arquivo quando o Chatwoot
 * reporta um attachment genérico do tipo "file" (ex.: "pdf", "docx") — apenas "pdf" tem
 * tratamento downstream hoje; os demais caem no fallback "none" (nenhum processamento).
 * Ver docs/reverse-engineering.md, Seção 5.
 */
export type MessageType = string | null;

export interface NormalizedIncomingMessage {
  id: string | null;
  timestamp: string | null;
  type: MessageType;
  content: string | null;
  contentUrl: string | null;
}

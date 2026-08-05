export interface ConversationMeta {
  assigneeName: string;
  assigneeType: string | null;
  status: string | null;
  labels: readonly unknown[];
}

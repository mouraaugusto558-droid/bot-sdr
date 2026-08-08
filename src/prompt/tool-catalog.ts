/**
 * Catálogo dos 8 tools do agente (docs/reverse-engineering.md, Seção 7) — fonte única
 * para o teste de drift prompt↔tools e, futuramente, para o Tool Registry (M6).
 *
 * `graphName` é o nome usado como tool no grafo/LangGraph; `promptLabel` é o trecho pelo
 * qual a tool é referenciada dentro do texto do system prompt — nem sempre igual ao
 * graphName (as 4 tools RAG usam um rótulo em português no prompt).
 */
export interface ToolCatalogEntry {
  graphName: string;
  promptLabel: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { graphName: 'pergunta', promptLabel: 'FERRAMENTA: Pergunta' },
  { graphName: 'preocupacoes', promptLabel: 'FERRAMENTA: Preocupações' },
  { graphName: 'faqProcedimentosOdonto', promptLabel: 'FERRAMENTA: FAQ Procedimentos Odonto' },
  { graphName: 'duvidas', promptLabel: 'FERRAMENTA: Dúvidas' },
  { graphName: 'Procedimento', promptLabel: 'FERRAMENTA: Procedimento' },
  { graphName: 'Anotar', promptLabel: 'FERRAMENTA: Anotar' },
  { graphName: 'leadsQuentes', promptLabel: 'FERRAMENTA: leadsQuentes' },
  { graphName: 'AtendimentoHumano', promptLabel: 'AtendimentoHumano' },
];

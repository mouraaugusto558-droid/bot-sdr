import type { z } from 'zod';
import type { Db } from '../adapters/postgres.adapter.js';
import { createInteresseClienteRepository } from '../repositories/interesse-cliente.repository.js';
import { createPreAgendamentosRepository } from '../repositories/pre-agendamentos.repository.js';
import { createLeadsQuentesRepository } from '../repositories/leads-quentes.repository.js';
import { createAtendimentoHumanoRepository } from '../repositories/atendimento-humano.repository.js';
import { createProcedimentoTool } from './write/procedimento.tool.js';
import { createAnotarTool } from './write/anotar.tool.js';
import { createLeadsQuentesTool } from './write/leads-quentes.tool.js';
import { createAtendimentoHumanoTool } from './write/atendimento-humano.tool.js';
import { createRagTools } from './rag/rag-tools.js';
import type { ToolSpec } from './tool-registry.js';

/** As 8 tools do agente (4 RAG + 4 de escrita) — docs/reverse-engineering.md, Seção 7. */
export function createAllToolSpecs(db: Db): ToolSpec<z.ZodObject>[] {
  const writeTools: ToolSpec<z.ZodObject>[] = [
    createProcedimentoTool(createInteresseClienteRepository(db)),
    createAnotarTool(createPreAgendamentosRepository(db)),
    createLeadsQuentesTool(createLeadsQuentesRepository(db)),
    createAtendimentoHumanoTool(createAtendimentoHumanoRepository(db)),
  ];
  return [...createRagTools(), ...writeTools];
}

export type { ToolExecutionContext, ToolSpec } from './tool-registry.js';
export { createLangGraphTool } from './tool-registry.js';

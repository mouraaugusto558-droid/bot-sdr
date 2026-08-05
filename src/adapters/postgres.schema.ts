import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Espelha as 5 tabelas Supabase já existentes usadas em produção pelo workflow original
 * (docs/reverse-engineering.md, Seção 13). Nomes de tabela/coluna preservados literalmente
 * — incluindo espaços/acentos/caixa inconsistente ("pré agendamentos", "NomeCompleto",
 * "Data_envio") — pois são exigidos por "Payload/estrutura/campos" da compatibilidade máxima.
 *
 * VERIFICAR ANTES DA PRIMEIRA MIGRATION: tipos de coluna e estratégia de chave primária
 * aqui são suposições razoáveis (id serial, timestamptz) — o export n8n não expõe o DDL
 * real das tabelas. Rodar `drizzle-kit introspect` contra o Supabase real e reconciliar
 * antes de aplicar qualquer migration gerada a partir deste arquivo.
 */

export const leadsNoturnos = pgTable('leads_noturnos', {
  id: serial('id').primaryKey(),
  numeroUsuario: text('numero_usuario').notNull(),
  nomeUsuario: text('nome_usuario'),
  dataEnvio: timestamp('data_envio', { withTimezone: true }),
});

export const preAgendamentos = pgTable('pré agendamentos', {
  id: serial('id').primaryKey(),
  userID: text('userID').notNull(),
  nomeCompleto: text('NomeCompleto'),
  periodoDoDia: text('período_do_dia'),
  dataEnvio: timestamp('Data_envio', { withTimezone: true }),
});

export const interesseCliente = pgTable('Interesse do cliente', {
  id: serial('id').primaryKey(),
  userID: text('userID').notNull(),
  procedimento: text('Procedimento'),
  dataEnvio: timestamp('Data_envio', { withTimezone: true }),
});

export const leadsQuentes = pgTable('leads_quentes', {
  id: serial('id').primaryKey(),
  nome: text('nome'),
  numero: text('numero').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }),
});

export const atendimentoHumano = pgTable('atendimento_humano', {
  id: serial('id').primaryKey(),
  telefone: text('telefone').notNull(),
  nome: text('nome'),
  dataEnvio: timestamp('data_envio', { withTimezone: true }),
});

import { loadEnv } from '../../config/env.js';
import { embedQuery } from '../../adapters/embeddings.adapter.js';
import { queryPineconeIndex } from '../../adapters/pinecone.adapter.js';
import { createRagToolSpec, type RagToolConfig, type RagToolDeps, type ragToolInputSchema } from './rag-tool.factory.js';
import type { ToolSpec } from '../tool-registry.js';

/**
 * Descrições extraídas verbatim dos 4 nós `toolVectorStore` do workflow original
 * (docs/reverse-engineering.md, Seção 7) — não reescrever, são o que o modelo usa para
 * decidir quando chamar cada tool.
 */
const PERGUNTA_DESCRIPTION = `Você é uma base de conhecimento que dá respostas sobre as perguntas frequentes dos clientes

SEMPRE utilize a ferramenta "Perguntas" para responder qualquer pergunta relacionada aos tópicos abaixo:

"A avaliação é gratuita?" "Quanto custa o tratamento?" "É caro?" "Vocês parcelam?" "E se eu não puder pagar tudo agora?" "Quanto custa o protocolo?" "Implante é muito caro?" "Alinhador invisível é muito caro?" "O que tá incluso na avaliação com o voucher?" "Esse voucher é de verdade mesmo?" "Tem desconto à vista?" "Vocês fazem orçamento online?" "E se eu quiser saber valores exatos agora?"`;

const PREOCUPACOES_DESCRIPTION = `Você é uma base de conhecimento que dá respostas sobre as perguntas frequentes dos clientes

SEMPRE utilize a ferramenta "Preocupaçoes" para responder qualquer pergunta relacionada aos topicos abaixo:


"Como sei que posso confiar?" "A clínica é de confiança mesmo?" "Já fui em outros lugares e só me enganaram." "Tenho medo de dentista…" "O procedimento dói?" "E o pós-operatório? Dói muito?" "E se for um caso difícil?" "Tem contraindicação pra colocar implante?" "Tenho dor de cabeça, pode ser bruxismo?" "Sinto estalos na mandíbula, isso é normal?" "A dor na face pode vir dos dentes?" "Tenho dor ao mastigar só de um lado." "A dor é na coluna também, pode ter a ver com dente?"`;

const FAQ_PROCEDIMENTOS_ODONTO_DESCRIPTION = `Você é uma base de conhecimento que dá respostas sobre as perguntas frequentes dos clientes

SEMPRE utilize a ferramenta "Vector store" para responder qualquer pergunta relacionada aos tópicos abaixo:

"Quais tratamentos vocês oferecem?" "Trabalham com Invisalign?" "Fazem aparelho ortodôntico convencional?" "Vocês fazem ortodontia com aparelho fixo também?" "É verdade que vocês fazem os alinhadores lá mesmo?" "Quanto tempo leva o tratamento com alinhadores?" "Usar alinhador dói?" "Implante pode ser feito com dente já extraído?" "E se tiver que arrancar o dente?" "Vocês fazem canal?" "Trabalham com estética também? (Facetas, lentes, etc.)" "Fazem clareamento também?" "Fazem limpeza e raspagem?" "Vocês fazem tratamento para bruxismo?" "Vocês têm prótese removível?" "Vocês fazem harmonização facial?" "O que é sedação consciente?"
`;

const DUVIDAS_DESCRIPTION = `Você é uma base de conhecimento que dá respostas sobre as perguntas frequentes dos clientes

SEMPRE utilize a ferramenta "Dúvidas" para responder qualquer pergunta relacionada aos tópicos abaixo:

"Fica onde?" "Fica perto de onde?" "Tem estacionamento?" "A clínica é grande ou é só uma sala?" "Vocês atendem convênio?" "Já fiz orçamento em outro lugar." "Quero só uma avaliação, sem compromisso." "E se eu não gostar do plano?" "Vou pensar mais um pouco." "Demora pra iniciar o tratamento depois da avaliação?" "Quanto tempo dura o tratamento?" "Moro longe, vale a pena ir até aí?"`;

const ragDeps: RagToolDeps = { embedQuery, queryIndex: queryPineconeIndex };

function ragToolConfigs(): RagToolConfig[] {
  const env = loadEnv();
  return [
    { graphName: 'pergunta', indexName: env.PINECONE_INDEX_PERGUNTA, description: PERGUNTA_DESCRIPTION },
    { graphName: 'preocupacoes', indexName: env.PINECONE_INDEX_PREOCUPACOES, description: PREOCUPACOES_DESCRIPTION },
    {
      graphName: 'faqProcedimentosOdonto',
      indexName: env.PINECONE_INDEX_FAQ_PROCEDIMENTOS,
      description: FAQ_PROCEDIMENTOS_ODONTO_DESCRIPTION,
    },
    { graphName: 'duvidas', indexName: env.PINECONE_INDEX_DUVIDAS, description: DUVIDAS_DESCRIPTION },
  ];
}

export function createRagTools(): ToolSpec<typeof ragToolInputSchema>[] {
  return ragToolConfigs().map((config) => createRagToolSpec(config, ragDeps));
}

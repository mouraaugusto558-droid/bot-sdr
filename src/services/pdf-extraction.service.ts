import { PDFParse } from 'pdf-parse';

/**
 * Equivalente ao node "Extrair Dados" (`extractFromFile`, operation `pdf`) — extração de
 * texto puro de um PDF, sem chamada a nenhum modelo. Ver docs/reverse-engineering.md, Seção 5.
 */
export async function extractPdfText(pdf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

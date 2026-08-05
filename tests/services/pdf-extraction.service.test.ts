import { describe, expect, it } from 'vitest';
import { extractPdfText } from '../../src/services/pdf-extraction.service.js';

const MINIMAL_PDF_WITH_TEXT = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 200 200] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 44 >>
stream
BT /F1 24 Tf 20 100 Td (Hello PDF) Tj ET
endstream
endobj
trailer << /Size 6 /Root 1 0 R >>
%%EOF`;

describe('extractPdfText', () => {
  it('extrai o texto puro de um PDF válido (equivalente ao node "Extrair Dados")', async () => {
    const buffer = Buffer.from(MINIMAL_PDF_WITH_TEXT, 'utf-8');

    const text = await extractPdfText(buffer);

    expect(text).toContain('Hello PDF');
  });
});

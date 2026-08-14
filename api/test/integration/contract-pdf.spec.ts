import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { ContractPdfService } from '../../src/contracts/contract-pdf.service';

const CONFIG = {
  get: (key: string) =>
    ({
      SELLER_NAME: 'Tory Teler',
      SELLER_DOCUMENT: 'C.C. 1.234.567.890',
      SELLER_EMAIL: 'hola@toryteler.co',
      SELLER_CITY: 'Medellín',
    })[key],
} as unknown as ConfigService;

const BASE = {
  reference: 'ord_a1b2c3d4e5f6',
  pieceTitle: 'Boceto de portada — primer disco',
  pieceDescription: 'Impresión de trabajo sobre papel mate, 30 × 30 cm.',
  priceCop: 2400000,
  buyerName: 'Ana Comprador',
  buyerDocument: '1020304050',
  buyerEmail: 'ana@ejemplo.co',
  consentTextVersion: 'v2',
};

const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

describe('contract document', () => {
  const pdf = new ContractPdfService(CONFIG);

  it('produces the same bytes for the same sale', async () => {
    // The whole scheme rests on this: the buyer signs a hash, and a document
    // that renders differently each time cannot be verified against it later.
    const first = await pdf.render(BASE);
    const second = await pdf.render(BASE);
    expect(hash(first)).toBe(hash(second));
  });

  it('changes when the sale changes', async () => {
    const other = await pdf.render({ ...BASE, priceCop: 2400001 });
    expect(hash(other)).not.toBe(hash(await pdf.render(BASE)));
  });

  it('names the seller, which v1 never did', async () => {
    // The text cannot be read back out — pdf-lib compresses the streams — so
    // this asks the question the other way round: if changing the seller
    // changes the document, the seller is in the document.
    const other = new ContractPdfService({
      get: (key: string) => (key === 'SELLER_NAME' ? 'Otra Persona' : CONFIG.get(key)),
    } as unknown as ConfigService);

    expect(hash(await other.render(BASE))).not.toBe(hash(await pdf.render(BASE)));
  });

  it('names the buyer', async () => {
    const other = await pdf.render({ ...BASE, buyerName: 'Otro Comprador' });
    expect(hash(other)).not.toBe(hash(await pdf.render(BASE)));
  });

  it('grows into more pages instead of running off the first one', async () => {
    const long = await pdf.render({
      ...BASE,
      pieceDescription: 'Una descripción muy larga. '.repeat(200),
    });
    const document = await PDFDocument.load(long);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it('survives a word longer than the column', async () => {
    const unbroken = 'x'.repeat(400);
    const buffer = await pdf.render({ ...BASE, pieceDescription: unbroken });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('adds the signature record as its own page, leaving the original intact', async () => {
    const original = await pdf.render(BASE);
    const before = (await PDFDocument.load(original)).getPageCount();

    const sealed = await pdf.seal(original, hash(original), new Date('2026-08-14T15:00:00Z'));
    const after = await PDFDocument.load(sealed);

    expect(after.getPageCount()).toBe(before + 1);

    // And the hash really is printed on it: a different hash, a different page.
    const withAnother = await pdf.seal(original, 'a'.repeat(64), new Date('2026-08-14T15:00:00Z'));
    expect(hash(withAnother)).not.toBe(hash(sealed));
  });
});

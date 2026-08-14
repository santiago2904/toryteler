import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface ContractData {
  reference: string;
  pieceTitle: string;
  pieceDescription: string;
  priceCop: number;
  buyerName: string;
  buyerDocument: string;
  buyerEmail: string;
  consentTextVersion: string;
}

/** The wording is versioned so a change never rewrites what someone signed. */
export const CONSENT_TEXT_VERSION = 'v1';

const A4: [number, number] = [595, 842];
const MARGIN = 50;

@Injectable()
export class ContractPdfService {
  /**
   * Builds the document with the real data of the sale. Generated here rather
   * than by a third party because the signer must see exactly the bytes we
   * hash, and a remote template could change under us.
   *
   * lazy: the legal wording needs a lawyer's review before launch. It is
   * versioned, so replacing it does not touch already signed contracts.
   */
  async render(data: ContractData): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage(A4);
    const money = new Intl.NumberFormat('es-CO').format(data.priceCop);

    const lines: [string, boolean][] = [
      ['CONTRATO DE COMPRAVENTA DE BIEN MUEBLE', true],
      ['', false],
      [`Referencia: ${data.reference}`, false],
      ['', false],
      ['COMPRADOR', true],
      [`${data.buyerName}, identificado con cédula ${data.buyerDocument},`, false],
      [`correo electrónico ${data.buyerEmail}.`, false],
      ['', false],
      ['OBJETO', true],
      [data.pieceTitle, false],
      ...this.wrap(data.pieceDescription, 90).map((l) => [l, false] as [string, boolean]),
      ['', false],
      ['PRECIO', true],
      [`$${money} COP, pagaderos en su totalidad al momento de la compra.`, false],
      ['', false],
      ['DECLARACIONES', true],
      ['El VENDEDOR declara que la pieza es auténtica y de su propiedad, y que', false],
      ['está facultado para venderla.', false],
      ['El COMPRADOR declara conocer el estado de la pieza y aceptarlo.', false],
      ['La entrega se hará a la dirección registrada en el pedido.', false],
      ['', false],
      ['FIRMA ELECTRÓNICA', true],
      ['Este documento se firma electrónicamente conforme a la Ley 527 de 1999', false],
      ['y al Decreto 2364 de 2012. La firma se acredita mediante la', false],
      ['verificación de un código enviado al comprador, cuyo registro se', false],
      ['conserva junto a este documento.', false],
      ['', false],
      [`Versión del texto de consentimiento: ${data.consentTextVersion}`, false],
    ];

    let y = A4[1] - MARGIN;
    for (const [text, isBold] of lines) {
      page.drawText(text, {
        x: MARGIN,
        y,
        size: isBold ? 11 : 10,
        font: isBold ? bold : font,
      });
      y -= 18;
    }

    return Buffer.from(await pdf.save());
  }

  /**
   * Stamps the signature record onto the signed document. A separate page, so
   * the hash of the original stays verifiable against what the signer saw.
   */
  async seal(original: Buffer, documentHash: string, signedAt: Date): Promise<Buffer> {
    const pdf = await PDFDocument.load(original);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage(A4);

    const stamp: [string, boolean][] = [
      ['CONSTANCIA DE FIRMA ELECTRÓNICA', true],
      ['', false],
      [`Fecha y hora de firma: ${signedAt.toISOString()}`, false],
      ['', false],
      ['Huella del documento firmado (SHA-256):', false],
      [documentHash.slice(0, 32), false],
      [documentHash.slice(32), false],
      ['', false],
      ['La integridad del documento puede verificarse recalculando esta huella', false],
      ['sobre las páginas anteriores a esta constancia.', false],
    ];

    let y = A4[1] - MARGIN;
    for (const [text, isBold] of stamp) {
      page.drawText(text, { x: MARGIN, y, size: isBold ? 11 : 10, font: isBold ? bold : font });
      y -= 18;
    }

    return Buffer.from(await pdf.save());
  }

  /** Naive wrap: enough for a description, and it avoids a dependency. */
  private wrap(text: string, width: number): string[] {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > width) {
        lines.push(current.trim());
        current = word;
      } else {
        current += ' ' + word;
      }
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
  }
}

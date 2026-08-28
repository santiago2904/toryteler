import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import { ContractLayout } from './contract-layout';

export interface ContractData {
  reference: string;
  pieceTitle: string;
  pieceDescription: string;
  priceCop: number;
  priceUsdCents: number | null;
  buyerName: string;
  buyerDocument: string;
  buyerEmail: string;
  consentTextVersion: string;
}

/**
 * The wording is versioned so a change never rewrites what someone signed.
 *
 * v2 identifies the seller — v1 said "the SELLER declares" without ever saying
 * who that was — numbers the clauses, and states the right of withdrawal that
 * Colombian law grants on distance sales.
 *
 * v3 adds the artist's fifteen-year buy-back conversation. Deliberately an
 * obligation to negotiate rather than a pacto de retroventa: that one caps at
 * four years (art. 1943) and a pacto de retracto at one (art. 1944), and both
 * would let the artist take the piece back. This does not. It obliges the
 * buyer to sit down and answer, and nothing more — which is what was asked
 * for, and what survives fifteen years.
 */
export const CONSENT_TEXT_VERSION = 'v3';

@Injectable()
export class ContractPdfService {
  constructor(private readonly config: ConfigService) {}

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
    const layout = await ContractLayout.create(pdf);
    const cop = new Intl.NumberFormat('es-CO').format(data.priceCop);
    const figure = data.priceUsdCents !== null
      ? `$${(data.priceUsdCents / 100).toFixed(2)} USD ($${cop} COP)`
      : `$${cop} COP`; // pedido antiguo, sin registro en dólares

    pdf.setTitle(`Contrato de compraventa · ${data.reference}`);
    pdf.setAuthor(this.seller().name);
    pdf.setSubject(data.pieceTitle);
    // Fixed dates: pdf-lib stamps the current time otherwise, and the same
    // sale would produce different bytes — and a different hash — every run.
    pdf.setCreationDate(new Date(0));
    pdf.setModificationDate(new Date(0));

    layout.title('Contrato de compraventa', data.reference);

    layout.section('Entre');
    const seller = this.seller();
    layout.entry(seller.name, `${seller.document} · ${seller.email}`, 'vendedor');
    layout.entry(data.buyerName, `C.C. ${data.buyerDocument} · ${data.buyerEmail}`, 'comprador');
    layout.space(4);

    layout.section('Objeto');
    layout.paragraph(data.pieceTitle, { size: 11.5 });
    if (data.pieceDescription) layout.paragraph(data.pieceDescription, { muted: true });

    layout.section('Precio');
    layout.figure(figure);
    layout.paragraph('Pagadero en su totalidad al momento de la compra.', { muted: true });

    layout.rule();
    layout.section('Cláusulas');

    const clauses = [
      `El VENDEDOR transfiere al COMPRADOR la propiedad de la pieza descrita, y declara que es de su propiedad, que está libre de gravámenes y que está facultado para venderla.`,
      `El VENDEDOR declara que la pieza es auténtica y que proviene de su propio trabajo o de su archivo personal, según se describe en el objeto de este contrato.`,
      `El COMPRADOR declara conocer el estado de la pieza, incluidas las marcas de uso o del paso del tiempo que la descripción menciona, y aceptarlo. Se trata de un objeto usado o único, no de un producto nuevo de fabricación en serie.`,
      `La entrega se hará a la dirección registrada en el pedido, dentro del territorio colombiano. El riesgo se transfiere al COMPRADOR con la entrega.`,
      `El COMPRADOR puede ejercer el derecho de retracto dentro de los cinco (5) días hábiles siguientes a la entrega, conforme al artículo 47 de la Ley 1480 de 2011, devolviendo la pieza en el mismo estado en que la recibió.`,
      `Durante los quince (15) años siguientes a la firma de este contrato, el VENDEDOR podrá manifestar por escrito al COMPRADOR su interés en recomprar la pieza. El COMPRADOR se obliga a atender esa manifestación y a negociar de buena fe un precio aceptable para ambas partes, dentro de los treinta (30) días siguientes a recibirla.`,
      `La obligación anterior es de negociar, no de vender: si las partes no llegan a un acuerdo, el COMPRADOR conserva la propiedad de la pieza sin ninguna consecuencia, y el VENDEDOR podrá volver a manifestar su interés más adelante dentro del mismo plazo. Esta cláusula no restringe la facultad del COMPRADOR de disponer de la pieza.`,
      `Este contrato se firma electrónicamente conforme a la Ley 527 de 1999 y al Decreto 2364 de 2012. La firma se acredita mediante la verificación de un código de un solo uso enviado al correo del COMPRADOR, cuyo registro se conserva junto a este documento.`,
      `Las partes acuerdan que este documento electrónico tiene la misma validez que uno en papel, y que su integridad se acredita mediante la huella criptográfica que consta en la constancia de firma.`,
      `Este contrato se rige por la ley colombiana. Cualquier controversia se resolverá ante los jueces competentes de ${seller.city}.`,
    ];
    clauses.forEach((text, index) => layout.clause(index + 1, text));

    layout.finish(`Referencia ${data.reference} · Texto ${data.consentTextVersion}`);
    return Buffer.from(await pdf.save());
  }

  /**
   * Stamps the signature record onto the signed document. A separate page, so
   * the hash of the original stays verifiable against what the signer saw.
   */
  async seal(original: Buffer, documentHash: string, signedAt: Date): Promise<Buffer> {
    const pdf = await PDFDocument.load(original);
    const layout = await ContractLayout.create(pdf);

    layout.title('Constancia de firma', signedAt.toISOString().slice(0, 10));

    layout.section('Momento de la firma');
    // Both forms: one to read and one to argue with. The ISO stamp is the
    // unambiguous one, and the sentence is the one anybody understands.
    layout.paragraph(this.readableDate(signedAt));
    layout.paragraph(`${signedAt.toISOString()} (UTC)`, { muted: true, size: 9 });

    layout.section('Huella del documento firmado');
    layout.paragraph('SHA-256, calculada sobre las páginas anteriores a esta constancia.', {
      muted: true,
    });
    // Split in two: sixty-four characters in one line are unreadable and
    // impossible to compare by eye against another hash.
    layout.paragraph(documentHash.slice(0, 32));
    layout.paragraph(documentHash.slice(32));

    layout.section('Cómo verificarla');
    layout.paragraph(
      'Extraiga las páginas anteriores a esta constancia y calcule su huella SHA-256. ' +
        'Si coincide con la anterior, el documento no ha sido modificado desde que se firmó.',
    );

    layout.finish('Constancia de firma electrónica · Toryteler', { numbered: false });
    return Buffer.from(await pdf.save());
  }

  /** "14 de agosto de 2026, 15:00 (hora de Colombia)". */
  private readableDate(date: Date): string {
    const formatted = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(date);
    return `${formatted} (hora de Colombia)`;
  }

  /**
   * Who is selling. Configurable because it is the artist's legal identity,
   * not a constant of the software — and because a contract that never says
   * who the seller is has a hole where a party should be.
   */
  private seller(): { name: string; document: string; email: string; city: string } {
    return {
      name: this.config.get<string>('SELLER_NAME') ?? 'Toryteler',
      document: this.config.get<string>('SELLER_DOCUMENT') ?? 'C.C. pendiente',
      email: this.config.get<string>('SELLER_EMAIL') ?? 'hola@toryteler.co',
      city: this.config.get<string>('SELLER_CITY') ?? 'Medellín',
    };
  }
}

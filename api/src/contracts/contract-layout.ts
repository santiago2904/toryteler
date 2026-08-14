import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/**
 * The little typesetter the contract is composed with.
 *
 * It exists because the previous version wrote lines at a fixed step from the
 * top of a single page: a long description ran off the paper, and the line
 * breaks were counted in characters, which means nothing in a proportional
 * font. Here every line is measured against the actual font and the page
 * breaks by itself when it runs out of room.
 *
 * Nothing in it depends on the current time, so the same data always produces
 * the same bytes — which is what makes the document's hash worth anything.
 */

export const A4: [number, number] = [595.28, 841.89];

const MARGIN = 56;
const BOTTOM = 72; // room for the footer
const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.82, 0.82, 0.82);

export class ContractLayout {
  private page!: PDFPage;
  private y = 0;
  readonly pages: PDFPage[] = [];

  private constructor(
    private readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {}

  static async create(pdf: PDFDocument): Promise<ContractLayout> {
    const layout = new ContractLayout(
      pdf,
      await pdf.embedFont(StandardFonts.Helvetica),
      await pdf.embedFont(StandardFonts.HelveticaBold),
    );
    layout.newPage();
    return layout;
  }

  get width(): number {
    return A4[0] - MARGIN * 2;
  }

  newPage(): void {
    this.page = this.pdf.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - MARGIN;
  }

  /** Opens a new page when what comes next would fall off this one. */
  private room(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  space(height: number): void {
    this.y -= height;
  }

  /** The document's title: the only thing set large. */
  title(text: string, reference: string): void {
    this.page.drawText(text, {
      x: MARGIN, y: this.y - 18, size: 17, font: this.bold, color: INK,
    });
    // The reference sits on the same line, right-aligned: it identifies the
    // document and belongs next to its name, not buried in the body.
    const width = this.regular.widthOfTextAtSize(reference, 9);
    this.page.drawText(reference, {
      x: A4[0] - MARGIN - width, y: this.y - 18, size: 9, font: this.regular, color: MUTED,
    });
    this.y -= 30;
    this.rule();
  }

  rule(): void {
    this.room(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4[0] - MARGIN, y: this.y },
      thickness: 0.5,
      color: RULE,
    });
    this.y -= 22;
  }

  /** A section label: small, spaced out, quiet. The body carries the weight. */
  section(label: string): void {
    this.room(40);
    let x = MARGIN;
    // Letter-spaced by hand: pdf-lib has no tracking, and a heading in caps
    // without it reads as a shout.
    for (const character of label.toUpperCase()) {
      this.page.drawText(character, { x, y: this.y, size: 8, font: this.bold, color: MUTED });
      x += this.bold.widthOfTextAtSize(character, 8) + 1.2;
    }
    this.y -= 16;
  }

  /** A paragraph, wrapped to the real width of the column. */
  paragraph(text: string, options: { size?: number; muted?: boolean } = {}): void {
    const size = options.size ?? 10;
    const font = this.regular;
    const leading = size * 1.55;

    for (const line of this.wrap(text, font, size, this.width)) {
      this.room(leading);
      this.page.drawText(line, {
        x: MARGIN, y: this.y, size, font, color: options.muted ? MUTED : INK,
      });
      this.y -= leading;
    }
    this.y -= 6;
  }

  /** A named party or figure: the name stands out, the detail does not. */
  entry(name: string, detail: string, role?: string): void {
    this.room(30);
    this.page.drawText(name, { x: MARGIN, y: this.y, size: 10.5, font: this.bold, color: INK });

    if (role) {
      const width = this.regular.widthOfTextAtSize(role, 9);
      this.page.drawText(role, {
        x: A4[0] - MARGIN - width, y: this.y, size: 9, font: this.regular, color: MUTED,
      });
    }
    this.y -= 14;

    if (detail) {
      this.page.drawText(detail, { x: MARGIN, y: this.y, size: 9.5, font: this.regular, color: MUTED });
      this.y -= 16;
    }
  }

  /** The price, or anything else that has to be read from across the room. */
  figure(text: string): void {
    this.room(30);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 15, font: this.bold, color: INK });
    this.y -= 24;
  }

  /** Numbered clauses, so a lawyer can point at one. */
  clause(number: number, text: string): void {
    const label = `${number}.`;
    const indent = 18;
    const leading = 15.5;
    const lines = this.wrap(text, this.regular, 10, this.width - indent);

    this.room(leading * lines.length);
    this.page.drawText(label, { x: MARGIN, y: this.y, size: 10, font: this.bold, color: INK });

    for (const line of lines) {
      this.room(leading);
      this.page.drawText(line, {
        x: MARGIN + indent, y: this.y, size: 10, font: this.regular, color: INK,
      });
      this.y -= leading;
    }
    this.y -= 5;
  }

  /**
   * Page numbers, drawn once the total is known — which is why this runs at
   * the end rather than as each page is opened.
   *
   * `numbered` is off for the signature record. It is appended to an already
   * signed document, and renumbering the pages before it would change their
   * bytes — and with them the hash the buyer signed.
   */
  finish(subtitle: string, options: { numbered?: boolean } = {}): void {
    this.pages.forEach((page, index) => {
      const label = options.numbered === false
        ? ''
        : `Página ${index + 1} de ${this.pages.length}`;
      const width = this.regular.widthOfTextAtSize(label, 8);

      page.drawLine({
        start: { x: MARGIN, y: BOTTOM - 14 },
        end: { x: A4[0] - MARGIN, y: BOTTOM - 14 },
        thickness: 0.5,
        color: RULE,
      });
      page.drawText(subtitle, {
        x: MARGIN, y: BOTTOM - 28, size: 8, font: this.regular, color: MUTED,
      });
      page.drawText(label, {
        x: A4[0] - MARGIN - width, y: BOTTOM - 28, size: 8, font: this.regular, color: MUTED,
      });
    });
  }

  /**
   * Breaks a paragraph against the measured width of the font. A word longer
   * than the column — a URL, a hash — is cut rather than allowed to run off
   * the page.
   */
  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    if (!text) return [];

    const lines: string[] = [];
    let current = '';

    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);

      if (font.widthOfTextAtSize(word, size) <= width) {
        current = word;
        continue;
      }
      // Nothing to break on: cut the word itself.
      let chunk = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(chunk + character, size) > width) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      current = chunk;
    }

    if (current) lines.push(current);
    return lines;
  }
}

import { purchaseConfirmed } from '../../src/mail/templates';

/**
 * The receipt is the only thing a buyer keeps, and a piece and a video are
 * opposite purchases. What is checked here is that each one is told what
 * applies to it and not told what does not.
 */
describe('purchase confirmation email', () => {
  const accountUrl = 'https://toryteler.co/cuenta';
  const piece = { kind: 'piece' as const, title: 'Boceto de portada' };
  const drop = { kind: 'drop' as const, title: 'Ojitos verdes' };

  describe('a piece on its own', () => {
    const mail = purchaseConfirmed({ items: [piece], accountUrl });

    it('speaks of the contract and the shipment', () => {
      expect(mail.html).toContain('Boceto de portada');
      expect(mail.html).toMatch(/contrato firmado/i);
      expect(mail.html).toMatch(/envío/i);
    });

    it('says nothing about a viewing window', () => {
      expect(mail.html).not.toMatch(/una sola vez/i);
      expect(mail.text).not.toMatch(/play/i);
    });
  });

  describe('a video on its own', () => {
    const mail = purchaseConfirmed({ items: [drop], accountUrl });

    it('warns that the window starts on play, not on purchase', () => {
      expect(mail.html).toMatch(/una sola vez/i);
      expect(mail.html).toMatch(/play/i);
    });

    it('does not promise a contract or a shipment that are not coming', () => {
      expect(mail.html).not.toMatch(/contrato/i);
      expect(mail.html).not.toMatch(/envío/i);
    });

    it('says so in the subject, where it is read first', () => {
      expect(mail.subject).toMatch(/video/i);
    });
  });

  describe('both in the same order', () => {
    const mail = purchaseConfirmed({ items: [drop, piece], accountUrl });

    it('carries both halves', () => {
      expect(mail.html).toContain('Boceto de portada');
      expect(mail.html).toContain('Ojitos verdes');
      expect(mail.html).toMatch(/contrato firmado/i);
      expect(mail.html).toMatch(/una sola vez/i);
    });

    it('puts the piece first, whatever order the items arrive in', () => {
      expect(mail.html.indexOf('Boceto de portada')).toBeLessThan(
        mail.html.indexOf('Ojitos verdes'),
      );
    });
  });

  describe('a signed piece', () => {
    const mail = purchaseConfirmed({ items: [{ ...piece, signed: true }], accountUrl });

    it('names the signature and warns it delays the shipment', () => {
      expect(mail.html).toMatch(/firmada por el artista/i);
      expect(mail.html).toMatch(/unos días después/i);
      expect(mail.text).toContain('(firmada por el artista)');
    });

    it('is silent about it when it was not asked for', () => {
      // Careful with the pattern: "el contrato firmado" is in every receipt
      // for a piece, and a looser one would pass on that alone.
      const plain = purchaseConfirmed({ items: [piece], accountUrl });
      expect(plain.html).not.toMatch(/firmada por el artista/i);
      expect(plain.html).not.toMatch(/unos días después/i);
    });
  });

  it('always carries a plain-text version and the account link', () => {
    for (const items of [[piece], [drop], [piece, drop]]) {
      const mail = purchaseConfirmed({ items, accountUrl });
      expect(mail.text.trim()).not.toBe('');
      expect(mail.text).toContain(accountUrl);
      expect(mail.html).toContain(accountUrl);
    }
  });
});

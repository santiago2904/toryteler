import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { testDb, truncateAll } from '../setup/db';
import { ContractsService } from '../../src/contracts/contracts.service';
import { CONSENT_TEXT_VERSION, ContractPdfService } from '../../src/contracts/contract-pdf.service';

/** The seller's legal identity, which the contract has to name. */
const SELLER_CONFIG = {
  get: (key: string) =>
    ({
      SELLER_NAME: 'Tory Teler',
      SELLER_DOCUMENT: 'C.C. 1.234.567.890',
      SELLER_EMAIL: 'hola@toryteler.co',
      SELLER_CITY: 'Medellín',
    })[key],
} as unknown as ConfigService;
import { OtpService } from '../../src/otp/otp.service';
import { MailService } from '../../src/mail/mail.service';
import { DocumentStore } from '../../src/storage/document-store';

class FakeMail {
  sent: { text: string }[] = [];
  async send(message: { text: string }) { this.sent.push({ text: message.text }); }
}

class FakeStore extends DocumentStore {
  saved: Buffer[] = [];
  async savePdf(buffer: Buffer, name: string): Promise<string> {
    this.saved.push(buffer);
    return `https://fake.test/${name}.pdf`;
  }
}

describe('contract signing', () => {
  let ds: DataSource;
  let contracts: ContractsService;
  let mail: FakeMail;
  let store: FakeStore;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    store = new FakeStore();
    contracts = new ContractsService(
      ds,
      new ContractPdfService(SELLER_CONFIG),
      new OtpService(ds, mail as unknown as MailService),
      store,
    );
  });

  beforeEach(async () => { await truncateAll(ds); mail.sent = []; store.saved = []; });
  afterAll(async () => { await ds.destroy(); });

  const signer = { fullName: 'Ana Ruiz', documentId: '1017234567', phone: '3001234567' };
  const codeFromMail = () => mail.sent[mail.sent.length - 1].text.match(/\b(\d{6})\b/)![1];

  async function orderWithPiece(): Promise<{ orderId: string; userId: string; pieceId: string }> {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const [p] = await ds.query(
      `INSERT INTO pieces (slug, title, description, price_cop, stock, status, published_at)
       VALUES ($1, 'Chaqueta de la gira', 'Teñida a mano, talla única.', 500000, 1, 'available', now())
       RETURNING id`, [`p-${Math.random().toString(36).slice(2)}`]);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference, shipping_address)
       VALUES ($1, 500000, 'CARD', $2, '{"line1":"x","city":"y"}') RETURNING id`,
      [u.id, `ord_${Math.random().toString(36).slice(2)}`]);
    await ds.query(
      `INSERT INTO order_items (order_id, piece_id, unit_price_cop) VALUES ($1, $2, 500000)`,
      [o.id, p.id]);
    return { orderId: o.id, userId: u.id, pieceId: p.id };
  }

  const validSign = (prepared: { contractId: string; otpChallengeId: string }) =>
    contracts.sign(prepared.contractId, {
      otpChallengeId: prepared.otpChallengeId,
      code: codeFromMail(),
      ip: '190.1.2.3',
      userAgent: 'jest',
      scrolledToEnd: true,
    });

  describe('prepare', () => {
    it('builds a real PDF and stores its hash', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);

      expect(prepared.pdfUrl).toContain('.pdf');
      expect(prepared.documentHash).toMatch(/^[a-f0-9]{64}$/);
      // The stored hash must match the bytes that were saved.
      expect(createHash('sha256').update(store.saved[0]).digest('hex')).toBe(prepared.documentHash);
      // A PDF, not a text file pretending to be one.
      expect(store.saved[0].subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('records the signer on the user', async () => {
      const { orderId, userId } = await orderWithPiece();
      await contracts.prepare(orderId, signer);
      const [u] = await ds.query(`SELECT full_name, document_id FROM users WHERE id = $1`, [userId]);
      expect(u.full_name).toBe('Ana Ruiz');
      expect(u.document_id).toBe('1017234567');
    });

    it('asking twice returns the same contract and does not change the hash', async () => {
      const { orderId } = await orderWithPiece();
      const a = await contracts.prepare(orderId, signer);
      const b = await contracts.prepare(orderId, signer);
      expect(b.contractId).toBe(a.contractId);
      expect(b.documentHash).toBe(a.documentHash);
      const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM contracts`);
      expect(count).toBe(1);
    });

    it('refuses an order with nothing physical', async () => {
      const [u] = await ds.query(`INSERT INTO users (email) VALUES ('solo@digital.co') RETURNING id`);
      const [o] = await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 25000, 'CARD', 'ord_digital') RETURNING id`, [u.id]);
      await expect(contracts.prepare(o.id, signer)).rejects.toThrow(/NO_PHYSICAL_ITEM/);
    });
  });

  describe('sign', () => {
    it('records the full evidence record', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);
      await validSign(prepared);

      const [c] = await ds.query(
        `SELECT status, signed_at, evidence FROM contracts WHERE id = $1`, [prepared.contractId]);
      expect(c.status).toBe('signed_pending_payment');
      expect(c.signed_at).not.toBeNull();
      expect(c.evidence.document_hash).toBe(prepared.documentHash);
      expect(c.evidence.signer.document_id).toBe('1017234567');
      // Against the constant, not a literal: what matters is that the version
      // in force is the one recorded, and pinning the number here would break
      // this test every time the wording is revised.
      expect(c.evidence.consent_text_version).toBe(CONSENT_TEXT_VERSION);
      expect(c.evidence.ip).toBe('190.1.2.3');
      expect(c.evidence.otp_verification_id).toBe(prepared.otpChallengeId);
      expect(c.evidence.document_scrolled_to_end).toBe(true);
    });

    it('refuses a wrong code and leaves the contract in draft', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);
      await expect(contracts.sign(prepared.contractId, {
        otpChallengeId: prepared.otpChallengeId, code: '000000',
        ip: '1.1.1.1', userAgent: 'jest', scrolledToEnd: true,
      })).rejects.toThrow(/INVALID_OTP/);
      const [c] = await ds.query(`SELECT status FROM contracts WHERE id = $1`, [prepared.contractId]);
      expect(c.status).toBe('draft');
    });

    it('refuses to sign what was not read, without spending an attempt', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);
      await expect(contracts.sign(prepared.contractId, {
        otpChallengeId: prepared.otpChallengeId, code: codeFromMail(),
        ip: '1.1.1.1', userAgent: 'jest', scrolledToEnd: false,
      })).rejects.toThrow(/DOCUMENT_NOT_READ/);

      const [otp] = await ds.query(`SELECT attempts, verified_at FROM otp_challenges LIMIT 1`);
      expect(otp.attempts).toBe(0);
      expect(otp.verified_at).toBeNull();
    });

    it('cannot be signed twice', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);
      await validSign(prepared);
      await expect(validSign(prepared)).rejects.toThrow(/CONTRACT_NOT_SIGNABLE/);
    });

    it('the database refuses a signed contract without evidence', async () => {
      const { orderId } = await orderWithPiece();
      const prepared = await contracts.prepare(orderId, signer);
      await expect(ds.query(
        `UPDATE contracts SET status = 'executed' WHERE id = $1`, [prepared.contractId],
      )).rejects.toThrow();
    });
  });
});

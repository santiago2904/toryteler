import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { OtpService } from '../otp/otp.service';
import { DocumentStore } from '../storage/document-store';
import { firstRow } from '../database/rows';
import { CONSENT_TEXT_VERSION, ContractPdfService } from './contract-pdf.service';

export interface SignerData {
  fullName: string;
  documentId: string;
  phone: string;
}

export interface SignInput {
  otpChallengeId: string;
  code: string;
  ip: string;
  userAgent: string;
  scrolledToEnd: boolean;
}

export interface PreparedContract {
  contractId: string;
  pdfUrl: string;
  documentHash: string;
  otpChallengeId: string;
}

@Injectable()
export class ContractsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly pdf: ContractPdfService,
    private readonly otp: OtpService,
    private readonly store: DocumentStore,
  ) {}

  /**
   * Builds the document and sends the code. Idempotent by nature: asking twice
   * returns the same contract, because regenerating it would change the hash
   * and invalidate what the buyer is about to sign.
   */
  async prepare(orderId: string, signer: SignerData): Promise<PreparedContract> {
    const row = firstRow<{
      order_id: string; reference: string; user_id: string; email: string;
      piece_id: string; title: string; description: string; unit_price_cop: number;
    }>(
      await this.ds.query(
        `SELECT o.id AS order_id, o.reference, o.user_id, u.email,
                p.id AS piece_id, p.title, coalesce(p.description, '') AS description,
                oi.unit_price_cop
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id AND oi.piece_id IS NOT NULL
           JOIN pieces p ON p.id = oi.piece_id
           JOIN users u ON u.id = o.user_id
          WHERE o.id = $1
          LIMIT 1`,
        [orderId],
      ),
    );
    if (!row) throw new NotFoundException('NO_PHYSICAL_ITEM');

    // The signer's name and document are needed on the contract, so they are
    // recorded on the user before it is built.
    await this.ds.query(
      `UPDATE users SET full_name = $2, document_id = $3, phone = $4 WHERE id = $1`,
      [row.user_id, signer.fullName, signer.documentId, signer.phone],
    );

    const existing = firstRow<{ id: string; pdf_url: string; document_hash: string }>(
      await this.ds.query(
        `SELECT id, pdf_url, document_hash FROM contracts
          WHERE order_id = $1 AND piece_id = $2`,
        [orderId, row.piece_id],
      ),
    );

    if (existing) {
      return {
        contractId: existing.id,
        pdfUrl: existing.pdf_url,
        documentHash: existing.document_hash,
        otpChallengeId: await this.otp.issue(row.user_id, 'CONTRACT_SIGNATURE'),
      };
    }

    const buffer = await this.pdf.render({
      reference: row.reference,
      pieceTitle: row.title,
      pieceDescription: row.description,
      priceCop: row.unit_price_cop,
      buyerName: signer.fullName,
      buyerDocument: signer.documentId,
      buyerEmail: row.email,
      consentTextVersion: CONSENT_TEXT_VERSION,
    });

    const documentHash = createHash('sha256').update(buffer).digest('hex');
    const pdfUrl = await this.store.savePdf(buffer, `${row.reference}-${row.piece_id}`);

    const contract = firstRow<{ id: string }>(
      await this.ds.query(
        `INSERT INTO contracts (order_id, piece_id, pdf_url, document_hash)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [orderId, row.piece_id, pdfUrl, documentHash],
      ),
    );
    if (!contract) throw new Error('CONTRACT_INSERT_FAILED');

    return {
      contractId: contract.id,
      pdfUrl,
      documentHash,
      otpChallengeId: await this.otp.issue(row.user_id, 'CONTRACT_SIGNATURE'),
    };
  }

  /**
   * Signs. The order matters: reading the document comes first, then the code.
   * Spending an OTP attempt on someone who has not read the contract would
   * punish them for our own check.
   */
  async sign(contractId: string, input: SignInput): Promise<void> {
    if (!input.scrolledToEnd) throw new BadRequestException('DOCUMENT_NOT_READ');

    const contract = firstRow<{
      id: string; document_hash: string; full_name: string | null;
      document_id: string | null; email: string;
    }>(
      await this.ds.query(
        `SELECT c.id, c.document_hash, u.full_name, u.document_id, u.email
           FROM contracts c
           JOIN orders o ON o.id = c.order_id
           JOIN users u ON u.id = o.user_id
          WHERE c.id = $1 AND c.status = 'draft'`,
        [contractId],
      ),
    );
    if (!contract) throw new NotFoundException('CONTRACT_NOT_SIGNABLE');

    if (!(await this.otp.verify(input.otpChallengeId, input.code))) {
      throw new BadRequestException('INVALID_OTP');
    }

    // Everything Decreto 2364 asks of a reliable signature: who signed, that
    // they agreed, that the document is intact, and when it happened.
    const evidence = {
      document_hash: contract.document_hash,
      signer: {
        full_name: contract.full_name,
        document_id: contract.document_id,
        email: contract.email,
      },
      consent_text_version: CONSENT_TEXT_VERSION,
      otp_verification_id: input.otpChallengeId,
      ip: input.ip,
      user_agent: input.userAgent,
      document_scrolled_to_end: input.scrolledToEnd,
    };

    await this.ds.query(
      `UPDATE contracts
          SET status = 'signed_pending_payment', signed_at = now(), evidence = $2
        WHERE id = $1 AND status = 'draft'`,
      [contractId, JSON.stringify(evidence)],
    );
  }
}

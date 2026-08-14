import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { affectedRows, firstRow } from '../database/rows';

const MAX_ATTEMPTS = 5;
const LIFETIME_MINUTES = 10;

export type OtpPurpose = 'CONTRACT_SIGNATURE';

@Injectable()
export class OtpService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly mail: MailService,
  ) {}

  /** Issues a six-digit code and returns the challenge id, never the code. */
  async issue(userId: string, purpose: OtpPurpose): Promise<string> {
    // randomInt, not Math.random: this code is evidence in a contract.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    const row = firstRow<{ id: string }>(
      await this.ds.query(
        `INSERT INTO otp_challenges (user_id, purpose, code_hash, expires_at)
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))
         RETURNING id`,
        [userId, purpose, this.hash(code), LIFETIME_MINUTES],
      ),
    );
    if (!row) throw new Error('OTP_INSERT_FAILED');

    const user = firstRow<{ email: string }>(
      await this.ds.query(`SELECT email FROM users WHERE id = $1`, [userId]),
    );
    await this.mail.send(
      user!.email,
      'Tu código para firmar',
      `<p>Tu código es <b>${code}</b>. Vence en ${LIFETIME_MINUTES} minutos.</p>`,
    );

    return row.id;
  }

  /**
   * Consumes the challenge. A code works once, within its lifetime, and only
   * while attempts remain — a six-digit code without a ceiling is guessable in
   * an afternoon.
   *
   * The whole check is one conditional UPDATE: reading and then writing would
   * let two simultaneous tries both pass.
   */
  async verify(challengeId: string, code: string): Promise<boolean> {
    const result = await this.ds.query(
      `UPDATE otp_challenges
          SET verified_at = now()
        WHERE id = $1
          AND verified_at IS NULL
          AND expires_at > now()
          AND attempts < $3
          AND code_hash = $2`,
      [challengeId, this.hash(code), MAX_ATTEMPTS],
    );
    if (affectedRows(result) === 1) return true;

    // A wrong code costs an attempt. A correct one never gets here.
    await this.ds.query(
      `UPDATE otp_challenges SET attempts = attempts + 1
        WHERE id = $1 AND verified_at IS NULL`,
      [challengeId],
    );
    return false;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}

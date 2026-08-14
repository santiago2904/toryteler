import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { DataSource } from 'typeorm';
import { affectedRows, firstRow } from '../../database/rows';

interface StoredKey {
  request_hash: string;
  response_body: unknown;
  status_code: number | null;
}

/**
 * Makes a write endpoint safe to retry.
 *
 * The client sends one Idempotency-Key per attempt. Claiming the key is the
 * first thing that happens, and it happens with an INSERT: whoever wins the row
 * runs the handler, everyone else gets the stored answer. Checking first and
 * inserting later would let two simultaneous requests both decide they are the
 * original.
 *
 * A key seen again with a different body is rejected rather than answered: it
 * means the client reused a key for a different intention, and returning the
 * first response would silently discard the second request.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const key: string | undefined = req.headers['idempotency-key'];
    if (!key) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');

    const endpoint = `${req.method} ${req.route?.path ?? req.url}`;
    const hash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');
    const userId: string | null = req.user?.id ?? null;

    return from(this.claim(key, userId, endpoint, hash)).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.request_hash !== hash) throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          // Claimed but unfinished: the original request is still running.
          if (existing.response_body === null) throw new ConflictException('REQUEST_IN_PROGRESS');
          return of(existing.response_body);
        }

        return next.handle().pipe(
          tap({
            next: (body) => void this.store(key, body),
            // A failed handler must not leave the key claimed forever, or the
            // client could never retry.
            error: () => void this.discard(key),
          }),
        );
      }),
    );
  }

  /** Inserts the key; returns the existing row if someone claimed it first. */
  private async claim(
    key: string,
    userId: string | null,
    endpoint: string,
    hash: string,
  ): Promise<StoredKey | null> {
    // RETURNING is mandatory here: an INSERT … ON CONFLICT DO NOTHING without
    // it reports nothing at all, so there would be no way to tell "I claimed
    // it" from "someone else already had it".
    const inserted = await this.ds.query(
      `INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, userId, endpoint, hash],
    );
    if (affectedRows(inserted) === 1) return null;

    return firstRow<StoredKey>(
      await this.ds.query(`SELECT * FROM idempotency_keys WHERE key = $1`, [key]),
    );
  }

  private async store(key: string, body: unknown): Promise<void> {
    await this.ds.query(
      `UPDATE idempotency_keys SET response_body = $2, status_code = 201 WHERE key = $1`,
      [key, JSON.stringify(body ?? {})],
    );
  }

  private async discard(key: string): Promise<void> {
    await this.ds.query(`DELETE FROM idempotency_keys WHERE key = $1`, [key]);
  }
}

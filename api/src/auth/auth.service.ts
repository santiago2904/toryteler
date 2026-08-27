import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { magicLink } from '../mail/templates';
import { affectedRows, firstRow, returnedRows } from '../database/rows';

const LINK_MINUTES = 20;
const SESSION_DAYS = 30;
/** Long enough to fill an address, read a contract and pay; not a day more. */
const CHECKOUT_SCOPE_MINUTES = 120;

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Finds the account for this email or creates it. There is no "register"
   * step: an email address is all the identity the store needs until someone
   * signs a contract.
   *
   * Shared by the magic link request and by guest checkout — both are just
   * "here is an email, give me the account behind it".
   */
  async upsertUserByEmail(email: string): Promise<string> {
    const user = firstRow<{ id: string }>(
      await this.ds.query(
        `INSERT INTO users (email) VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [email],
      ),
    );
    if (!user) throw new Error('USER_UPSERT_FAILED');
    return user.id;
  }

  /**
   * Sends a link. The response never says whether the address existed — that
   * would turn this endpoint into a way to find out who has bought here.
   */
  async requestMagicLink(email: string): Promise<void> {
    const userId = await this.upsertUserByEmail(email);

    const token = randomBytes(32).toString('hex');
    await this.ds.query(
      `INSERT INTO magic_links (user_id, token, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [userId, token, LINK_MINUTES],
    );

    const url = `${this.config.get<string>('PUBLIC_WEB_URL')}/auth/verify?token=${token}`;
    await this.mail.send({ to: email, ...magicLink(url, LINK_MINUTES) });
  }

  /**
   * Redeems the link. Marking it used and reading the owner happen in the same
   * statement: two clicks on the same link cannot both succeed.
   */
  async redeem(token: string): Promise<{ userId: string; sessionToken: string }> {
    const rows = returnedRows<{ user_id: string }>(
      await this.ds.query(
        `UPDATE magic_links SET used_at = now()
          WHERE token = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING user_id`,
        [token],
      ),
    );
    if (rows.length === 0) throw new UnauthorizedException('INVALID_OR_USED');

    const userId = rows[0].user_id;
    return { userId, sessionToken: this.signSession(userId) };
  }

  /**
   * `scope` is `'account'` for a real login (magic link redeemed — the email
   * was proved) or an order id for a guest who just typed an email at
   * checkout without proving anything. A checkout-scoped token only ever
   * unlocks the order it names: `SessionGuard` accepts either, but `/me/*`
   * and `/admin/*` require `'account'` explicitly, so typing a stranger's
   * email at checkout never opens their account, only creates an order under
   * it.
   *
   * Checkout scope expires fast — it only needs to outlive one checkout, not
   * a browsing session.
   */
  signSession(userId: string, scope: string = 'account'): string {
    const days = scope === 'account' ? SESSION_DAYS : CHECKOUT_SCOPE_MINUTES / 1440;
    const expiresAt = Date.now() + days * 86_400_000;
    const payload = Buffer.from(JSON.stringify({ sub: userId, scope, exp: expiresAt })).toString(
      'base64url',
    );
    return `${payload}.${this.sign(payload)}`;
  }

  /** Returns the identity behind the token, or null for anything that does not verify. */
  verifySession(value: string): { userId: string; scope: string } | null {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;

    const expected = this.sign(payload);
    // Constant-time: a length or early-exit difference leaks how much of a
    // forged signature was right.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const { sub, exp, scope } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (typeof exp !== 'number' || exp < Date.now()) return null;
      if (typeof sub !== 'string') return null;
      // Tokens signed before scope existed have none: treat them as a real
      // account session rather than invalidate every session in flight.
      return { userId: sub, scope: typeof scope === 'string' ? scope : 'account' };
    } catch {
      return null;
    }
  }

  /** True when the user exists and is the artist. */
  async isAdmin(userId: string): Promise<boolean> {
    const row = firstRow<{ is_admin: boolean }>(
      await this.ds.query(`SELECT is_admin FROM users WHERE id = $1`, [userId]),
    );
    return row?.is_admin === true;
  }

  /** Discards every outstanding link of a user. Used after a successful login. */
  async invalidateOtherLinks(userId: string, keepToken: string): Promise<number> {
    const result = await this.ds.query(
      `UPDATE magic_links SET used_at = now()
        WHERE user_id = $1 AND token <> $2 AND used_at IS NULL`,
      [userId, keepToken],
    );
    return affectedRows(result);
  }

  private sign(payload: string): string {
    const secret = this.config.get<string>('SESSION_SECRET') ?? '';
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }
}

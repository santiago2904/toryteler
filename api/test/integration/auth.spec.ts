import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { AuthService } from '../../src/auth/auth.service';
import { OtpService } from '../../src/otp/otp.service';
import { MailService } from '../../src/mail/mail.service';

/** Captures what would have been sent, so the code can be read back. */
class FakeMail {
  sent: { to: string; html: string }[] = [];
  async send(to: string, _subject: string, html: string) { this.sent.push({ to, html }); }
}

const CONFIG = {
  get: (k: string) =>
    ({ SESSION_SECRET: 'a'.repeat(40), PUBLIC_WEB_URL: 'http://web.test' } as Record<string, string>)[k],
} as ConfigService;

describe('auth', () => {
  let ds: DataSource;
  let auth: AuthService;
  let otp: OtpService;
  let mail: FakeMail;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    const asMail = mail as unknown as MailService;
    auth = new AuthService(ds, asMail, CONFIG);
    otp = new OtpService(ds, asMail);
  });

  beforeEach(async () => { await truncateAll(ds); mail.sent = []; });
  afterAll(async () => { await ds.destroy(); });

  const tokenFromDb = async (): Promise<string> => {
    const [link] = await ds.query(`SELECT token FROM magic_links ORDER BY created_at DESC LIMIT 1`);
    return link.token;
  };

  describe('magic link', () => {
    it('creates the account when it does not exist', async () => {
      await auth.requestMagicLink('nuevo@x.co');
      const [user] = await ds.query(`SELECT id FROM users WHERE email = 'nuevo@x.co'`);
      expect(user).toBeDefined();
      expect(mail.sent).toHaveLength(1);
    });

    it('reuses the account on a second request', async () => {
      await auth.requestMagicLink('a@x.co');
      await auth.requestMagicLink('a@x.co');
      const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM users`);
      expect(count).toBe(1);
    });

    it('redeems a token exactly once', async () => {
      await auth.requestMagicLink('b@x.co');
      const token = await tokenFromDb();
      const session = await auth.redeem(token);
      expect(session.sessionToken).toBeTruthy();
      await expect(auth.redeem(token)).rejects.toThrow(/INVALID_OR_USED/);
    });

    it('refuses an expired token', async () => {
      await auth.requestMagicLink('c@x.co');
      await ds.query(`UPDATE magic_links SET expires_at = now() - interval '1 minute'`);
      await expect(auth.redeem(await tokenFromDb())).rejects.toThrow(/INVALID_OR_USED/);
    });

    it('refuses a made-up token', async () => {
      await expect(auth.redeem('no-existe')).rejects.toThrow(/INVALID_OR_USED/);
    });

    it('logging in invalidates the other outstanding links', async () => {
      await auth.requestMagicLink('d@x.co');
      await auth.requestMagicLink('d@x.co');
      const token = await tokenFromDb();
      const { userId } = await auth.redeem(token);
      expect(await auth.invalidateOtherLinks(userId, token)).toBe(1);
    });
  });

  describe('session', () => {
    it('accepts what it signed', () => {
      const t = auth.signSession('11111111-1111-1111-1111-111111111111');
      expect(auth.verifySession(t)).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('rejects a tampered payload', () => {
      const t = auth.signSession('11111111-1111-1111-1111-111111111111');
      const forged = Buffer.from(JSON.stringify({ sub: 'otro', exp: Date.now() + 1000 }))
        .toString('base64url') + '.' + t.split('.')[1];
      expect(auth.verifySession(forged)).toBeNull();
    });

    it('rejects nonsense', () => {
      expect(auth.verifySession('basura')).toBeNull();
      expect(auth.verifySession('')).toBeNull();
    });
  });

  describe('otp', () => {
    const newUser = async (email: string): Promise<string> => {
      const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`, [email]);
      return u.id;
    };
    const codeFromMail = () => mail.sent[0].html.match(/\b(\d{6})\b/)![1];

    it('accepts the right code once', async () => {
      const id = await otp.issue(await newUser('e@x.co'), 'CONTRACT_SIGNATURE');
      const code = codeFromMail();
      await expect(otp.verify(id, code)).resolves.toBe(true);
      await expect(otp.verify(id, code)).resolves.toBe(false);
    });

    it('never stores the code in the clear', async () => {
      const id = await otp.issue(await newUser('f@x.co'), 'CONTRACT_SIGNATURE');
      const [row] = await ds.query(`SELECT code_hash FROM otp_challenges WHERE id = $1`, [id]);
      expect(row.code_hash).not.toContain(codeFromMail());
      expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('locks out after five wrong tries', async () => {
      const id = await otp.issue(await newUser('g@x.co'), 'CONTRACT_SIGNATURE');
      for (let i = 0; i < 5; i++) await otp.verify(id, '000000');
      await expect(otp.verify(id, codeFromMail())).resolves.toBe(false);
    });

    it('refuses an expired code', async () => {
      const id = await otp.issue(await newUser('h@x.co'), 'CONTRACT_SIGNATURE');
      await ds.query(`UPDATE otp_challenges SET expires_at = now() - interval '1 minute'`);
      await expect(otp.verify(id, codeFromMail())).resolves.toBe(false);
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { AdminService } from '../../src/admin/admin.service';
import { AuthService } from '../../src/auth/auth.service';

const CONFIG = {
  get: (k: string) =>
    ({ SESSION_SECRET: 'a'.repeat(40), PUBLIC_WEB_URL: 'http://web.test' } as Record<string, string>)[k],
} as ConfigService;

/** Captures what would have been sent, so a bounced invite can be told apart from a real one. */
class FakeMail {
  sent: { to: string }[] = [];
  async send(message: { to: string }) {
    this.sent.push({ to: message.to });
  }
}

describe('studio team', () => {
  let ds: DataSource;
  let admin: AdminService;
  let mail: FakeMail;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    admin = new AdminService(ds, new AuthService(ds, mail as never, CONFIG));
  });

  beforeEach(async () => {
    await truncateAll(ds);
    mail.sent = [];
  });
  afterAll(async () => { await ds.destroy(); });

  const newAdmin = async (email = `a-${Math.random().toString(36).slice(2)}@x.co`): Promise<string> => {
    const [u] = await ds.query(
      `INSERT INTO users (email, is_admin) VALUES ($1, true) RETURNING id`,
      [email],
    );
    return u.id as string;
  };

  it('lists everyone with the role', async () => {
    await newAdmin('tory@toryteler.co');
    const team = await admin.listTeam();
    expect(team.map((m) => m.email)).toEqual(['tory@toryteler.co']);
  });

  it('promotes a brand new email and mails it a way in', async () => {
    const member = await admin.addToTeam('ayudante@x.co');

    const [row] = await ds.query(`SELECT is_admin FROM users WHERE id = $1`, [member.id]);
    expect(row.is_admin).toBe(true);
    expect(mail.sent.map((m) => m.to)).toContain('ayudante@x.co');
  });

  it('promoting someone who already bought here keeps their history', async () => {
    const [buyer] = await ds.query(
      `INSERT INTO users (email) VALUES ('cliente@x.co') RETURNING id`,
    );
    const member = await admin.addToTeam('cliente@x.co');
    expect(member.id).toBe(buyer.id);
  });

  it('promoting twice does not fail', async () => {
    await admin.addToTeam('repetido@x.co');
    await expect(admin.addToTeam('repetido@x.co')).resolves.toBeDefined();
  });

  it('removes access', async () => {
    const keep = await newAdmin();
    const id = await newAdmin();
    await admin.removeFromTeam(id, keep);
    const [row] = await ds.query(`SELECT is_admin FROM users WHERE id = $1`, [id]);
    expect(row.is_admin).toBe(false);
  });

  it('refuses to remove yourself', async () => {
    const a = await newAdmin();
    const b = await newAdmin();
    await expect(admin.removeFromTeam(a, a)).rejects.toThrow(/CANNOT_REMOVE_SELF/);
    // Untouched — a rejected self-removal must not have taken b's slot with it.
    const [row] = await ds.query(`SELECT is_admin FROM users WHERE id = $1`, [b]);
    expect(row.is_admin).toBe(true);
  });

  it('refuses to leave the studio with nobody in it', async () => {
    const only = await newAdmin();
    const somebodyElse = await newAdmin(); // the requester, not the target
    await admin.removeFromTeam(only, somebodyElse);
    // That worked — two admins, one removed. Now try to remove the last one.
    await expect(admin.removeFromTeam(somebodyElse, only)).rejects.toThrow(/LAST_ADMIN/);
  });
});

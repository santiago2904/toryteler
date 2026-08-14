/**
 * Runs before anything else in the suite.
 *
 * Two things are forced here, both learned the hard way.
 *
 * The database: the suite truncates every table between cases, so pointing it
 * at the development one wipes whatever was seeded — and the failure shows up
 * later, somewhere unrelated, looking like a bug. The tests always use their
 * own, whatever .env says.
 *
 * The credentials: the moment real ones landed in .env, a test that registers
 * a user started sending real mail to made-up addresses. Anything that costs
 * money or leaves the machine belongs in this file.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://toryteler:toryteler@localhost:5433/toryteler_test';

process.env.RESEND_API_KEY = 're_test_xxx';
process.env.MAIL_FROM = 'Toryteler <pruebas@invalid>';
delete process.env.MAIL_REPLY_TO;

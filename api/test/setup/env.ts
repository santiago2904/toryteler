/**
 * Runs before anything else in the suite.
 *
 * The tests read the same .env as development, so the moment real credentials
 * land there a test that signs up a user starts sending real mail to made-up
 * addresses — and the provider rejects them, which is how this was found. A
 * placeholder key puts MailService back in its logging mode.
 *
 * Anything that costs money or leaves the machine belongs in this file.
 */
process.env.RESEND_API_KEY = 're_test_xxx';
process.env.MAIL_FROM = 'Toryteler <pruebas@invalid>';
delete process.env.MAIL_REPLY_TO;

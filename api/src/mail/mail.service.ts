import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Mailer {
  send(to: string, subject: string, html: string, dedupeKey?: string): Promise<void>;
}

@Injectable()
export class MailService implements Mailer {
  private readonly log = new Logger(MailService.name);
  private readonly sent = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  /**
   * `dedupeKey` is what keeps Wompi's webhook retries from sending the same
   * contract three times.
   *
   * lazy: dedupe lives in memory. Fine on one instance; move it to a table
   * before running more than one.
   */
  async send(to: string, subject: string, html: string, dedupeKey?: string): Promise<void> {
    if (dedupeKey && this.sent.has(dedupeKey)) return;

    const key = this.config.get<string>('RESEND_API_KEY') ?? '';
    // Placeholder credentials mean a local run: log instead of failing, so
    // developing does not require a real mail account.
    if (key.endsWith('xxx')) {
      // The body goes to the log too. Magic links and signing codes only ever
      // travel by mail, so without it the flow cannot be walked by hand.
      this.log.log(`[correo simulado] ${to} · ${subject}\n${this.asText(html)}`);
      if (dedupeKey) this.sent.add(dedupeKey);
      return;
    }

    const replyTo = this.config.get<string>('MAIL_REPLY_TO');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Configurable because the sender is the one thing a mail provider
        // refuses outright: it must be a domain verified in that account, and
        // a hardcoded one turns every send into a 403 nobody expected.
        from: this.config.get<string>('MAIL_FROM') ?? 'Toryteler <onboarding@resend.dev>',
        to,
        subject,
        html,
        // Where an answer lands. This one can be any address — a personal
        // mailbox included — because nobody has to prove they own the place
        // replies go to, only the place mail comes from.
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      // The body says which of the two it is — an unverified sender or a
      // recipient the sandbox will not deliver to — and guessing costs an hour.
      throw new Error(`RESEND_FAILED_${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    if (dedupeKey) this.sent.add(dedupeKey);
  }

  /** Enough to read a link or a code in a terminal. */
  private asText(html: string): string {
    return html
      .replace(/<a [^>]*href="([^"]+)"[^>]*>/g, '$1 ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

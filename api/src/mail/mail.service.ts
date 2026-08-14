import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message } from './templates';

export interface Outgoing extends Message {
  to: string;
  /** What keeps a retried webhook from sending the same receipt three times. */
  dedupeKey?: string;
}

export interface Mailer {
  send(message: Outgoing): Promise<void>;
}

@Injectable()
export class MailService implements Mailer {
  private readonly log = new Logger(MailService.name);
  private readonly sent = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  /**
   * lazy: dedupe lives in memory. Fine on one instance; move it to a table
   * before running more than one.
   */
  async send(message: Outgoing): Promise<void> {
    if (message.dedupeKey && this.sent.has(message.dedupeKey)) return;

    const key = this.config.get<string>('RESEND_API_KEY') ?? '';
    // Placeholder credentials mean a local run: log instead of failing, so
    // developing does not require a real mail account. The plain-text version
    // goes to the console — magic links and signing codes only travel by
    // mail, so without it the flow cannot be walked by hand.
    if (key.endsWith('xxx')) {
      this.log.log(`[correo simulado] ${message.to} · ${message.subject}\n${message.text}`);
      if (message.dedupeKey) this.sent.add(message.dedupeKey);
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
        to: message.to,
        subject: message.subject,
        html: message.html,
        // Sent alongside the HTML: a message without a text part is likelier
        // to be filed as spam, and some clients show nothing without it.
        text: message.text,
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
    if (message.dedupeKey) this.sent.add(message.dedupeKey);
  }
}

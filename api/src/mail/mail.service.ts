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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Toryteler <no-reply@toryteler.com>', to, subject, html }),
    });
    if (!res.ok) throw new Error(`RESEND_FAILED_${res.status}`);
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

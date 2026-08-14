import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Where to send the buyer. Card details never touch this server. */
  @Post('orders/:id/pay')
  @UseGuards(SessionGuard)
  start(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.startPayment(id);
  }

  /**
   * The provider's callback. Deliberately unguarded: it carries no session,
   * because it is not a person. What authenticates it is its signature, checked
   * inside handleWebhook, and a body that fails that check is rejected.
   *
   * Always 200 on success, and fast: a provider that gets anything else retries,
   * which is fine — settling is idempotent — but noisy.
   */
  @Post('payments/webhook')
  @HttpCode(200)
  async webhook(@Body() body: unknown) {
    await this.payments.handleWebhook(body);
    return { ok: true };
  }
}

import {
  Body, Controller, ForbiddenException, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { PaymentsService } from './payments.service';

type Authenticated = Request & { user: { id: string; scope: string } };

/** Same rule every checkout endpoint follows: a guest's token only opens its own order. */
function assertOrderScope(scope: string, orderId: string): void {
  if (scope !== 'account' && scope !== orderId) throw new ForbiddenException('ORDER_SCOPE_MISMATCH');
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Where to send the buyer. Card details never touch this server. */
  @Post('orders/:id/pay')
  @UseGuards(SessionGuard)
  start(@Param('id', ParseUUIDPipe) id: string, @Req() req: Authenticated) {
    assertOrderScope(req.user.scope, id);
    return this.payments.startPayment(id);
  }

  /**
   * Asks the provider what happened, on the way back from paying.
   *
   * The buyer lands here with a transaction id in the URL; this turns it into
   * a settled order without waiting for the webhook. Same idempotent path, so
   * the webhook arriving later changes nothing.
   */
  @Post('orders/:id/confirm')
  @UseGuards(SessionGuard)
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { transactionId: string },
    @Req() req: Authenticated,
  ) {
    assertOrderScope(req.user.scope, id);
    await this.payments.confirm(id, req.user.id, body.transactionId);
    return { ok: true };
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

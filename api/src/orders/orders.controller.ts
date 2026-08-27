import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req,
  UnauthorizedException, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { OptionalSessionGuard } from '../auth/session.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { AccountService } from './account.service';
import { PAYMENT_METHODS } from './order.entity';
import type { PaymentMethod } from './order.entity';
import { OrdersService } from './orders.service';

class ShippingAddressDto {
  @IsString() line1!: string;
  @IsString() city!: string;
  @IsString() phone!: string;
}

class CreateOrderDto {
  /**
   * Slugs, never prices. The cart lives in the browser, so anything it sends
   * about money is a suggestion the server ignores.
   */
  @IsArray() @IsString({ each: true }) @ArrayMaxSize(50)
  pieceSlugs!: string[];

  @IsArray() @IsString({ each: true }) @ArrayMaxSize(50)
  dropSlugs!: string[];

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethod;

  @IsOptional() @ValidateNested() @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  /** Which pieces go signed. Read as a subset of `pieceSlugs`. */
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(50)
  signedPieceSlugs?: string[];

  /**
   * Only read when the caller has no session: buying does not require having
   * clicked a magic link first, just an email to put the order under. Ignored
   * when a session is already present — the account's own email wins.
   */
  @IsOptional() @IsEmail()
  email?: string;
}

type MaybeAuthenticated = Request & { user?: { id: string; scope: string } };

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly auth: AuthService,
    private readonly account: AccountService,
  ) {}

  /**
   * Creating an order takes stock, so it must be safe to retry: a lost response
   * on a flaky connection must not cost the buyer two pieces.
   *
   * No session required. A returning buyer's session is used as-is; a guest
   * gives an email instead, which finds or creates the account exactly like a
   * magic link would, and a checkout-scoped session for that one order comes
   * back so the rest of the flow (contract, payment) works without asking
   * again. Proving that email is real still happens — the contract's own OTP
   * for a piece, nothing extra for a video, same as before.
   */
  @Post()
  @UseGuards(OptionalSessionGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Body() body: CreateOrderDto, @Req() req: MaybeAuthenticated) {
    const { email, ...input } = body;

    // A real account session needs nothing more — every step already
    // authorizes by ownership. A guest's session, even an existing one, does
    // not: it only ever unlocks the single order it was minted for, so a
    // *second* order under the same guest cookie still needs a *new* token,
    // scoped to that new order — reusing the old one would leave the buyer
    // holding a cookie that opens the wrong pedido.
    const hasAccountSession = req.user?.scope === 'account';

    let userId = req.user?.id;
    if (!userId) {
      if (!email) throw new BadRequestException('EMAIL_REQUIRED');
      userId = await this.auth.upsertUserByEmail(email);
    }

    const order = await this.orders.create(userId, input);
    return hasAccountSession
      ? order
      : { ...order, sessionToken: this.auth.signSession(userId, order.id) };
  }

  /**
   * One order, for the buyer's own return trip from the payment gateway. A
   * real account session sees any of its own orders; a guest's
   * checkout-scoped token only sees the order it names — same rule
   * `SessionGuard` leaves to every checkout endpoint.
   */
  @Get(':id')
  @UseGuards(OptionalSessionGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: MaybeAuthenticated) {
    if (!req.user) throw new UnauthorizedException('NO_SESSION');

    const order = await this.account.orderById(id);
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');

    const owns = req.user.scope === 'account' ? order.userId === req.user.id : req.user.scope === id;
    // 404, not 403: a stranger should not learn the order exists at all.
    if (!owns) throw new NotFoundException('ORDER_NOT_FOUND');

    const { userId: _userId, ...summary } = order;
    return summary;
  }
}

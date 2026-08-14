import { Body, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
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
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Creating an order takes stock, so it must be safe to retry: a lost response
   * on a flaky connection must not cost the buyer two pieces.
   */
  @Post()
  @UseGuards(SessionGuard)
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() body: CreateOrderDto, @Req() req: Request & { user: { id: string } }) {
    return this.orders.create(req.user.id, body);
  }
}

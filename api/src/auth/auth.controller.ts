import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RequestLinkDto {
  @IsEmail()
  email!: string;
}

class RedeemDto {
  @IsString()
  @MinLength(20)
  token!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Always answers the same, whether or not the address is known. Telling a
   * caller that an email exists here is telling them who bought from the shop.
   */
  @Post('magic-link')
  async requestLink(@Body() body: RequestLinkDto) {
    await this.auth.requestMagicLink(body.email);
    return { ok: true };
  }

  @Post('redeem')
  redeem(@Body() body: RedeemDto) {
    return this.auth.redeem(body.token);
  }
}

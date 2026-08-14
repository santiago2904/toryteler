import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { ContractsService } from './contracts.service';

class PrepareDto {
  @IsString() @Length(3, 120) fullName!: string;
  @IsString() @Length(5, 20) documentId!: string;
  @IsString() @Length(7, 20) phone!: string;
}

class SignDto {
  @IsString() otpChallengeId!: string;

  @Matches(/^\d{6}$/, { message: 'CODE_MUST_BE_6_DIGITS' })
  code!: string;

  /** The buyer says they reached the end of the document. */
  @IsBoolean() scrolledToEnd!: boolean;
}

type Authenticated = Request & { user: { id: string } };

@Controller()
@UseGuards(SessionGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  /** Builds the PDF and sends the code. Asking twice returns the same document. */
  @Post('orders/:id/contract')
  prepare(@Param('id', ParseUUIDPipe) id: string, @Body() body: PrepareDto) {
    return this.contracts.prepare(id, body);
  }

  /**
   * Signing happens before paying: the other way round there would be an
   * instant with money taken and no contract behind it.
   *
   * The IP and the user agent are read from the connection, never from the
   * body — they are evidence, and evidence the signer can type is not evidence.
   */
  @Post('contracts/:id/sign')
  async sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SignDto,
    @Req() req: Authenticated,
  ) {
    await this.contracts.sign(id, {
      ...body,
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return { ok: true };
  }
}

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';
import type { Request, Response } from 'express';
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
   * The document itself, served to the person it names and nobody else.
   *
   * Not a link to storage: that URL is signed but never expires, and it opens
   * a file carrying a full name and an ID number. Here the session decides,
   * and it decides on every request.
   */
  @Get('contracts/:id/document')
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Authenticated,
    @Res() res: Response,
  ) {
    const pdf = await this.contracts.document(id, req.user.id);

    res.setHeader('Content-Type', 'application/pdf');
    // Inline: the buyer is about to sign it, so it has to open, not download.
    res.setHeader('Content-Disposition', 'inline; filename="contrato.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
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

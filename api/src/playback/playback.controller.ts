import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { PlaybackService } from './playback.service';

@Controller('entitlements')
@UseGuards(SessionGuard)
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  /**
   * The only place a playback URL is ever handed out, and only to the session
   * that owns the access. It is a POST because it has a consequence: the first
   * call starts the clock the buyer cannot stop.
   */
  @Post(':id/play')
  play(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.playback.play(id, req.user.id, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}

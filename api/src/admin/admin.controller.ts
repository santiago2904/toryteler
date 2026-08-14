import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard, SessionGuard } from '../auth/session.guard';
import { UploadSignatureService } from '../storage/upload-signature.service';
import { DocumentStore } from '../storage/document-store';
import { VideoUploadService } from '../storage/video-upload.service';
import { AdminService } from './admin.service';
import type { NewDrop, NewPiece } from './admin.service';

/**
 * The artist's own endpoints. Two guards in order: the session resolves who is
 * asking, and the role is read from the database on every request rather than
 * baked into the token, so revoking it takes effect immediately.
 */
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly uploads: UploadSignatureService,
    private readonly videos: VideoUploadService,
    private readonly store: DocumentStore,
  ) {}

  /** What the browser needs to upload an image straight to Cloudinary. */
  @Post('uploads/signature')
  signUpload(@Body() body: { folder?: 'pieces' | 'posters' }) {
    return this.uploads.sign(body.folder === 'posters' ? 'posters' : 'pieces');
  }

  /** A one-time URL to send a video straight to Cloudflare Stream. */
  @Post('uploads/video')
  createVideoUpload(@Body() body: { maxDurationSeconds?: number }) {
    return this.videos.createUpload(body.maxDurationSeconds);
  }

  /** Whether that video finished transcoding and can be published. */
  @Get('uploads/video/:uid')
  videoStatus(@Param('uid') uid: string) {
    return this.videos.status(uid);
  }

  /**
   * A frame of the video, to look at while choosing the poster.
   *
   * Proxied rather than linked because the video is protected: its thumbnails
   * answer 401 to a browser, and handing the browser a signed URL for them
   * would be handing it a key to the video itself.
   */
  @Get('uploads/video/:uid/frame')
  async frame(
    @Param('uid') uid: string,
    @Query('seconds') seconds: string,
    @Res() res: Response,
  ) {
    const image = await this.videos.frame(uid, Number(seconds) || 0);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(image);
  }

  /**
   * Freezes that frame as the poster: it is copied to public storage, because
   * the shop shows it to people who have not bought anything.
   */
  @Post('uploads/video/:uid/poster')
  async poster(@Param('uid') uid: string, @Body() body: { seconds?: number }) {
    const image = await this.videos.frame(uid, body.seconds ?? 0);
    return { image: await this.store.saveImage(image, 'posters') };
  }

  @Get('pieces')
  listPieces() {
    return this.admin.listPieces();
  }

  @Get('pieces/:slug')
  findPiece(@Param('slug') slug: string) {
    return this.admin.findPiece(slug);
  }

  @Get('drops')
  listDrops() {
    return this.admin.listDrops();
  }

  @Get('drops/:slug')
  findDrop(@Param('slug') slug: string) {
    return this.admin.findDrop(slug);
  }

  @Post('pieces')
  createPiece(@Body() body: NewPiece) {
    return this.admin.createPiece(body);
  }

  @Patch('pieces/:id')
  async updatePiece(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<NewPiece>) {
    await this.admin.updatePiece(id, body);
    return { ok: true };
  }

  @Patch('pieces/:id/listed')
  async listPiece(@Param('id', ParseUUIDPipe) id: string, @Body() body: { listed: boolean }) {
    await this.admin.setPieceListed(id, body.listed);
    return { ok: true };
  }

  @Post('drops')
  createDrop(@Body() body: NewDrop) {
    return this.admin.createDrop(body);
  }

  @Patch('drops/:id')
  async updateDrop(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<NewDrop>) {
    await this.admin.updateDrop(id, body);
    return { ok: true };
  }

  @Patch('drops/:id/listed')
  async listDrop(@Param('id', ParseUUIDPipe) id: string, @Body() body: { listed: boolean }) {
    await this.admin.setDropListed(id, body.listed);
    return { ok: true };
  }

  @Get('orders')
  orders() {
    return this.admin.orders();
  }

  @Post('orders/:id/ship')
  async ship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { carrier: string; number: string },
  ) {
    await this.admin.markShipped(id, body);
    return { ok: true };
  }

  @Get('contracts')
  contracts() {
    return this.admin.contracts();
  }
}

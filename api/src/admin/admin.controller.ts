import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard, SessionGuard } from '../auth/session.guard';
import { UploadSignatureService } from '../storage/upload-signature.service';
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
  ) {}

  /** What the browser needs to upload an image straight to Cloudinary. */
  @Post('uploads/signature')
  signUpload(@Body() body: { folder?: 'pieces' | 'posters' }) {
    return this.uploads.sign(body.folder === 'posters' ? 'posters' : 'pieces');
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

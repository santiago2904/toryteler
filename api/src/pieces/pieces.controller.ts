import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PiecesService } from './pieces.service';

@Controller('pieces')
export class PiecesController {
  constructor(private readonly pieces: PiecesService) {}

  @Get()
  list() {
    return this.pieces.listPublished();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const piece = await this.pieces.findBySlug(slug);
    if (!piece) throw new NotFoundException('PIECE_NOT_FOUND');
    return piece;
  }
}

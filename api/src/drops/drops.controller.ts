import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DropsService } from './drops.service';

@Controller('drops')
export class DropsController {
  constructor(private readonly drops: DropsService) {}

  @Get()
  list() {
    return this.drops.listPublished();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const drop = await this.drops.findBySlug(slug);
    if (!drop) throw new NotFoundException('DROP_NOT_FOUND');
    return drop;
  }
}

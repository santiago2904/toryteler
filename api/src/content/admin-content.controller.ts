import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import type { Request } from 'express';
import { AccountGuard, AdminGuard } from '../auth/session.guard';
import { ContentService } from './content.service';

class UpdateContentDto {
  @IsString() @IsNotEmpty() value!: string;
}

type Authenticated = Request & { user: { id: string } };

/** Los 43 textos editoriales, para el panel de /studio/contenido. */
@Controller('admin/content')
@UseGuards(AccountGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list() {
    return this.content.listForAdmin();
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() body: UpdateContentDto,
    @Req() req: Authenticated,
  ) {
    await this.content.setOverride(key, body.value, req.user.id);
    return { ok: true };
  }

  @Delete(':key')
  async reset(@Param('key') key: string) {
    await this.content.resetOverride(key);
    return { ok: true };
  }
}

import { Controller, Get } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  overrides() {
    return this.content.getOverrides();
  }
}

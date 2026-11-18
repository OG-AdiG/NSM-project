import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArtistsService } from './artists.service';

@ApiTags('artists')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get()
  @ApiOperation({ summary: 'Publiczna lista aktywnych artystów (do formularza zgłoszenia)' })
  list() {
    return this.artists.listActive();
  }
}

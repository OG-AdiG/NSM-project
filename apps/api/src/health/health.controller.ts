import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Status API' })
  check() {
    return {
      status: 'ok',
      service: 'nsm-api',
      timestamp: new Date().toISOString(),
    };
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstimatePriceDto } from './dto/estimate-price.dto';
import { estimateTattooPrice } from './estimate';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  @Post('estimate')
  @ApiOperation({ summary: 'Kalkulator widełek cenowych (FR-09, publiczny)' })
  estimate(@Body() dto: EstimatePriceDto) {
    return estimateTattooPrice(dto);
  }
}

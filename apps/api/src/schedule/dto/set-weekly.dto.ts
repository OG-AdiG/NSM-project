import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';

export class WeeklySlotDto {
  @ApiProperty({ example: 1, description: 'ISO weekday 1=pon … 7=nd' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ example: 600, description: 'Start w minutach od 00:00 (10:00 = 600)' })
  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  startMin!: number;

  @ApiProperty({ example: 1080, description: 'Koniec w minutach (18:00 = 1080)' })
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  endMin!: number;
}

export class SetWeeklyAvailabilityDto {
  @ApiProperty({ type: [WeeklySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotDto)
  slots!: WeeklySlotDto[];
}

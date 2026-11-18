import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAbsenceDto {
  @ApiProperty({ example: '2026-12-01T00:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-12-03T23:59:59.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Urlop' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

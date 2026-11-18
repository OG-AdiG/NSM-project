import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateQuoteDto {
  @ApiProperty({ example: 900, description: 'Cena ostateczna w PLN' })
  @Type(() => Number)
  @IsInt({ message: 'Cena musi być liczbą całkowitą' })
  @Min(50, { message: 'Minimalna wycena to 50 zł' })
  @Max(100_000)
  finalPricePln!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  sessionCount?: number;

  @ApiPropertyOptional({ example: 700 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimateMinPln?: number;

  @ApiPropertyOptional({ example: 1100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimateMaxPln?: number;

  @ApiPropertyOptional({ example: 'Cena obejmuje konsultację i jedną sesję do 3 h.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quoteNote?: string;
}

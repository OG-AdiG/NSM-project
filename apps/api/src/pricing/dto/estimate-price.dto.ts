import { ApiProperty } from '@nestjs/swagger';
import { ColorMode } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class EstimatePriceDto {
  @ApiProperty({ example: 'średni (5–15 cm)' })
  @IsString()
  @MinLength(1)
  size!: string;

  @ApiProperty({ example: 'fineline' })
  @IsString()
  @MinLength(1)
  style!: string;

  @ApiProperty({ enum: ColorMode })
  @IsEnum(ColorMode)
  colorMode!: ColorMode;

  @ApiProperty({ example: 'przedramię' })
  @IsString()
  @MinLength(1)
  bodyPart!: string;
}

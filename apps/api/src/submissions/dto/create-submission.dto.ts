import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ColorMode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'Chcę mały tatuaż z gałązką eukaliptusa na przedramieniu.' })
  @IsString()
  @MinLength(10, { message: 'Opis musi mieć co najmniej 10 znaków' })
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ example: 'przedramię' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bodyPart!: string;

  @ApiProperty({ example: 'ok. 8–10 cm' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  size!: string;

  @ApiProperty({ example: 'fineline' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  style!: string;

  @ApiProperty({ enum: ColorMode, example: ColorMode.BLACK_GREY })
  @IsEnum(ColorMode, { message: 'Wybierz kolor lub czerń/szarość' })
  colorMode!: ColorMode;

  @ApiPropertyOptional({ description: 'ID użytkownika-artysty (opcjonalnie)' })
  @IsOptional()
  @IsString()
  preferredArtistId?: string;

  @ApiPropertyOptional({
    example: '2026-12-15',
    description: 'Preferowana data (YYYY-MM-DD lub ISO)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Podaj poprawną preferowaną datę' })
  preferredDate?: string;

  @ApiPropertyOptional({ description: 'Preferowany początek slotu (ISO)' })
  @ValidateIf((o: CreateSubmissionDto) => Boolean(o.preferredSlotStart || o.preferredSlotEnd))
  @IsDateString({}, { message: 'Podaj poprawną godzinę początku' })
  @IsOptional()
  preferredSlotStart?: string;

  @ApiPropertyOptional({ description: 'Preferowany koniec slotu (ISO)' })
  @ValidateIf((o: CreateSubmissionDto) => Boolean(o.preferredSlotStart || o.preferredSlotEnd))
  @IsDateString({}, { message: 'Podaj poprawną godzinę końca' })
  @IsOptional()
  preferredSlotEnd?: string;

  @ApiPropertyOptional({ example: 'Najchętniej po 16:00' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferredTimeNote?: string;
}

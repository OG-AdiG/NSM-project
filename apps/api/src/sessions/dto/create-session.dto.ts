import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ description: 'ID użytkownika-artysty' })
  @IsString()
  artistId!: string;

  @ApiPropertyOptional({ description: 'Zgłoszenie ACCEPTED (wymagane dla klienta)' })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiProperty({ example: '2026-12-10T10:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-12-10T12:00:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: SessionType, default: SessionType.SESSION })
  @IsOptional()
  @IsEnum(SessionType)
  type?: SessionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

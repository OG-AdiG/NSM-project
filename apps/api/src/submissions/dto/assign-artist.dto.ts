import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignArtistDto {
  @ApiPropertyOptional({
    description: 'ID użytkownika-artysty; null / pominięte = bez przypisania',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  preferredArtistId?: string | null;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectSubmissionDto {
  @ApiProperty({ example: 'Niestety nie realizuję motywów realistycznych w tym terminie.' })
  @IsString()
  @MinLength(5, { message: 'Podaj powód odrzucenia (min. 5 znaków)' })
  @MaxLength(2000)
  reason!: string;
}

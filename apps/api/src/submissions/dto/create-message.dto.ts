import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Czy możemy lekko zmniejszyć motyw?' })
  @IsString()
  @MinLength(1, { message: 'Wiadomość nie może być pusta' })
  @MaxLength(4000)
  body!: string;
}

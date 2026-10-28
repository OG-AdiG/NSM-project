import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'klient@example.com' })
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

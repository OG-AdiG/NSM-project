import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'klient@example.com' })
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail' })
  email!: string;
}

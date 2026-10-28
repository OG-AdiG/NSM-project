import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'klient@example.com' })
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail' })
  email!: string;

  @ApiProperty({ example: 'Haslo123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Hasło musi zawierać literę i cyfrę',
  })
  password!: string;

  @ApiPropertyOptional({ example: 'Anna' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kowalska' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}

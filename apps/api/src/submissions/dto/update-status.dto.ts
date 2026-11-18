import { ApiProperty } from '@nestjs/swagger';
import { SubmissionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSubmissionStatusDto {
  @ApiProperty({ enum: SubmissionStatus, example: SubmissionStatus.CANCELLED })
  @IsEnum(SubmissionStatus, { message: 'Nieprawidłowy status zgłoszenia' })
  status!: SubmissionStatus;
}

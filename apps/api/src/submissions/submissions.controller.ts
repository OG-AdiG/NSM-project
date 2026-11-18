import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { REFERENCE_PHOTO } from '../storage/photo-limits';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types';
import { AssignArtistDto } from './dto/assign-artist.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionStatusDto } from './dto/update-status.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Nowe zgłoszenie projektu (FR-07)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubmissionDto) {
    return this.submissions.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista zgłoszeń',
    description:
      'Klient: własne. Artysta: tylko przypisane do niego. Admin: wszystkie.',
  })
  list(@CurrentUser() user: AuthUser) {
    return this.submissions.listMine(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Szczegóły zgłoszenia' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.getOne(user, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Zmiana statusu zgłoszenia (FR-12)' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
  ) {
    return this.submissions.updateStatus(user, id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Przypisanie / odpięcie artysty (admin)' })
  assignArtist(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignArtistDto,
  ) {
    return this.submissions.assignArtist(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Usunięcie zgłoszenia (z plikami w MinIO)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.remove(user, id);
  }

  @Post(':id/photos')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Upload zdjęcia referencyjnego (FR-08)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: REFERENCE_PHOTO.maxBytes, files: 1 },
    }),
  )
  addPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: REFERENCE_PHOTO.maxBytes })],
        fileIsRequired: true,
        exceptionFactory: () =>
          new BadRequestException('Nieprawidłowy plik (sprawdź typ i rozmiar)'),
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.submissions.addPhoto(user, id, file);
  }

  @Delete(':id/photos/:photoId')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Usunięcie zdjęcia referencyjnego' })
  removePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.submissions.removePhoto(user, id, photoId);
  }
}

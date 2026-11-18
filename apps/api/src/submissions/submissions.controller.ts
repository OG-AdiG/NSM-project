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
  Query,
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
  ApiQuery,
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
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RejectSubmissionDto } from './dto/reject-submission.dto';
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
  @ApiOperation({ summary: 'Nowe zgłoszenie (FR-07) + widełki FR-09' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubmissionDto) {
    return this.submissions.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista zgłoszeń (rola + filtry)' })
  @ApiQuery({ name: 'unassigned', required: false, description: 'Tylko bez artysty (admin)' })
  @ApiQuery({ name: 'archived', required: false, description: 'Archiwum soft-delete (admin)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('unassigned') unassigned?: string,
    @Query('archived') archived?: string,
  ) {
    return this.submissions.listMine(user, {
      unassigned: unassigned === '1' || unassigned === 'true',
      archived: archived === '1' || archived === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Szczegóły zgłoszenia' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.getOne(user, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Zmiana statusu (bez wyceny/odrzucenia)' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
  ) {
    return this.submissions.updateStatus(user, id, dto);
  }

  @Post(':id/quote')
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Wycena ostateczna z kwotą (FR-11)' })
  createQuote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.submissions.createQuote(user, id, dto);
  }

  @Post(':id/reject')
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Odrzucenie z powodem (FR-10/12)' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectSubmissionDto,
  ) {
    return this.submissions.reject(user, id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Przypisanie artysty (pula bez artysty)' })
  assignArtist(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignArtistDto,
  ) {
    return this.submissions.assignArtist(user, id, dto);
  }

  @Post(':id/restore')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Przywrócenie z archiwum' })
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.restore(user, id);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Usunięcie twarde lub soft-delete/archiwum' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.remove(user, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Wątek wiadomości (FR-10)' })
  listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.submissions.listMessages(user, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Nowa wiadomość w wątku (FR-10)' })
  addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.submissions.addMessage(user, id, dto);
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

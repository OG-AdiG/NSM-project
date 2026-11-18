import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Roles(Role.CLIENT, Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Rezerwacja terminu (FR-15), wielosesyjność (FR-16)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista sesji' })
  @ApiQuery({ name: 'submissionId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('submissionId') submissionId?: string) {
    return this.sessions.list(user, submissionId);
  }

  @Get('project/:submissionId')
  @ApiOperation({ summary: 'Postęp sesji w projekcie (FR-16)' })
  project(@CurrentUser() user: AuthUser, @Param('submissionId') submissionId: string) {
    return this.sessions.projectProgress(user, submissionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Szczegóły sesji' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.getOne(user, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Anulowanie sesji' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.cancel(user, id);
  }

  @Patch(':id/confirm')
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Potwierdzenie (do czasu Stripe FR-19)' })
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.confirm(user, id);
  }

  @Patch(':id/complete')
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Oznaczenie sesji jako zakończonej' })
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.complete(user, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { SetWeeklyAvailabilityDto } from './dto/set-weekly.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@Controller()
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('artists/:artistId/availability')
  @ApiOperation({ summary: 'Cotygodniowy grafik artysty (FR-13, publiczny odczyt)' })
  getWeekly(@Param('artistId') artistId: string) {
    return this.schedule.getWeekly(artistId);
  }

  @Put('artists/:artistId/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Ustawienie grafiku tygodniowego (FR-13)' })
  setWeekly(
    @CurrentUser() user: AuthUser,
    @Param('artistId') artistId: string,
    @Body() dto: SetWeeklyAvailabilityDto,
  ) {
    return this.schedule.setWeekly(user, artistId, dto);
  }

  @Get('artists/:artistId/absences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Lista nieobecności (FR-13)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listAbsences(
    @Param('artistId') artistId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.schedule.listAbsences(artistId, from, to);
  }

  @Post('artists/:artistId/absences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Dodanie nieobecności (FR-13)' })
  createAbsence(
    @CurrentUser() user: AuthUser,
    @Param('artistId') artistId: string,
    @Body() dto: CreateAbsenceDto,
  ) {
    return this.schedule.createAbsence(user, artistId, dto);
  }

  @Delete('artists/:artistId/absences/:absenceId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST, Role.ADMIN)
  @ApiOperation({ summary: 'Usunięcie nieobecności' })
  deleteAbsence(
    @CurrentUser() user: AuthUser,
    @Param('artistId') artistId: string,
    @Param('absenceId') absenceId: string,
  ) {
    return this.schedule.deleteAbsence(user, artistId, absenceId);
  }

  @Get('artists/:artistId/slots')
  @ApiOperation({ summary: 'Wolne terminy (FR-14)' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'durationMinutes', required: false })
  getSlots(
    @Param('artistId') artistId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    return this.schedule.getFreeSlots(
      artistId,
      from,
      to,
      durationMinutes ? Number(durationMinutes) : 120,
    );
  }
}

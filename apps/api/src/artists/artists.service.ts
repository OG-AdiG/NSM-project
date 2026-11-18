import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.artistProfile.findMany({
      where: { active: true },
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        styles: true,
        bio: true,
        userId: true,
      },
    });
  }
}

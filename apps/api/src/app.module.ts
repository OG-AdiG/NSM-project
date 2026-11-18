import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArtistsModule } from './artists/artists.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { SubmissionsModule } from './submissions/submissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    AuthModule,
    ArtistsModule,
    SubmissionsModule,
    HealthModule,
  ],
})
export class AppModule {}

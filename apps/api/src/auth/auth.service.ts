import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenPayload, AuthUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Konto z tym adresem e-mail już istnieje');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.CLIENT,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
      },
    });

    await this.issueEmailVerification(user.id, user.email);

    return {
      message: 'Konto utworzone. Sprawdź skrzynkę e-mail, aby potwierdzić adres.',
      user,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Nieprawidłowy e-mail lub hasło');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Adres e-mail nie został potwierdzony. Sprawdź skrzynkę lub wyślij ponownie link weryfikacyjny.',
      );
    }

    const tokens = await this.issueSessionTokens(user);
    return {
      ...tokens,
      user: this.toAuthUser(user),
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: AuthTokenType.REFRESH,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!stored) {
      throw new UnauthorizedException('Token odświeżania nieważny');
    }

    await this.prisma.authToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });

    const tokens = await this.issueSessionTokens(stored.user);
    return {
      ...tokens,
      user: this.toAuthUser(stored.user),
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { message: 'Wylogowano' };
    }
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.authToken.updateMany({
      where: { tokenHash, type: AuthTokenType.REFRESH, usedAt: null },
      data: { usedAt: new Date() },
    });
    return { message: 'Wylogowano' };
  }

  async me(user: AuthUser) {
    return user;
  }

  async verifyEmail(token: string) {
    const record = await this.consumeOneTimeToken(token, AuthTokenType.EMAIL_VERIFY);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { message: 'Adres e-mail został potwierdzony. Możesz się zalogować.' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // nie ujawniamy, czy konto istnieje
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user.id, user.email);
    }
    return {
      message: 'Jeśli konto istnieje i nie jest zweryfikowane, wysłaliśmy link potwierdzający.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (user) {
      const raw = await this.createToken(user.id, AuthTokenType.PASSWORD_RESET, 60 * 60 * 1000);
      const link = `${this.webUrl()}/reset-hasla?token=${raw}`;
      await this.mail.sendPasswordResetEmail(user.email, link);
    }
    return {
      message: 'Jeśli konto istnieje, wysłaliśmy instrukcję resetu hasła na podany adres e-mail.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.consumeOneTimeToken(dto.token, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.updateMany({
        where: { userId: record.userId, type: AuthTokenType.REFRESH, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return { message: 'Hasło zostało zmienione. Zaloguj się nowym hasłem.' };
  }

  private async issueEmailVerification(userId: string, email: string) {
    await this.prisma.authToken.updateMany({
      where: { userId, type: AuthTokenType.EMAIL_VERIFY, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = await this.createToken(userId, AuthTokenType.EMAIL_VERIFY, 24 * 60 * 60 * 1000);
    const link = `${this.webUrl()}/weryfikacja-email?token=${raw}`;
    await this.mail.sendVerificationEmail(email, link);
  }

  private async issueSessionTokens(user: {
    id: string;
    email: string;
    role: Role;
  }) {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(this.parseDurationMs(accessTtl) / 1000),
    });

    const refreshRaw = await this.createToken(
      user.id,
      AuthTokenType.REFRESH,
      this.parseDurationMs(this.config.get<string>('JWT_REFRESH_TTL', '7d')),
    );

    return {
      accessToken,
      refreshToken: refreshRaw,
      tokenType: 'Bearer' as const,
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    };
  }

  private async createToken(userId: string, type: AuthTokenType, ttlMs: number) {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  private async consumeOneTimeToken(raw: string, type: AuthTokenType) {
    const tokenHash = this.hashToken(raw);
    const record = await this.prisma.authToken.findFirst({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) {
      throw new BadRequestException('Link jest nieważny lub wygasł');
    }
    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record;
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private webUrl() {
    return this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  private parseDurationMs(value: string): number {
    const m = /^(\d+)([smhd])$/i.exec(value.trim());
    if (!m) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
    emailVerifiedAt: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}

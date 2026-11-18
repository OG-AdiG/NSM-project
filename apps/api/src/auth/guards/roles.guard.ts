import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../types';

const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'klient',
  ARTIST: 'artysta',
  ADMIN: 'administrator',
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('Brak uprawnień — zaloguj się ponownie.');
    }

    if (!required.includes(user.role)) {
      const need = required.map((r) => ROLE_LABELS[r]).join(' lub ');
      const have = ROLE_LABELS[user.role] ?? user.role;
      throw new ForbiddenException(
        `Brak uprawnień do tej operacji. Wymagana rola: ${need}. Twoja rola: ${have}.`,
      );
    }

    return true;
  }
}

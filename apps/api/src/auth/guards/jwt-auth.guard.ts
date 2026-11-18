import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException('Musisz być zalogowany, aby wykonać tę operację.');
    }
    return user;
  }
}

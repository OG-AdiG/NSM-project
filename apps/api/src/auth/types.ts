import { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: Date | null;
};

import { Role } from '@prisma/client';

/** Payload embedded in both access and refresh tokens. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  /** Discriminates access from refresh tokens so one cannot be used as the other. */
  type: 'access' | 'refresh';
}

/** A user object that is safe to serialize — never carries the password hash. */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: SafeUser;
}

/** Express request after JwtAuthGuard has run. */
export interface RequestWithUser {
  user: SafeUser;
}

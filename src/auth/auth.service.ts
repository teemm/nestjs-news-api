import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EnvironmentVariables } from '../config/env.validation';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse, AuthTokens, JwtPayload, SafeUser } from './types/auth.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // A duplicate email raises Prisma P2002, mapped to 409 by AllExceptionsFilter.
    const user = await this.usersService.create({
      email: dto.email,
      password: passwordHash,
      name: dto.name,
    });

    this.logger.log(`Registered new user ${user.email}`);

    return { user, ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Compare against a dummy hash when the user is missing so the response
    // time does not reveal whether the email exists.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.password ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const safeUser = this.toSafeUser(user);

    return { user: safeUser, ...(await this.issueTokens(safeUser)) };
  }

  /** Verifies a refresh token and rotates the pair. */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Provided token is not a refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('The user attached to this token no longer exists');
    }

    return { user, ...(await this.issueTokens(user)) };
  }

  private async issueTokens(user: SafeUser): Promise<AuthTokens> {
    const base = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...base, type: 'access' } satisfies JwtPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', { infer: true }),
      }),
      this.jwtService.signAsync({ ...base, type: 'refresh' } satisfies JwtPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', { infer: true }),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: SafeUser & { password?: string }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

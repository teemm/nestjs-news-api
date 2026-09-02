import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvironmentVariables } from '../../config/env.validation';
import { UsersService } from '../../users/users.service';
import { JwtPayload, SafeUser } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Runs on every protected request; the return value becomes `request.user`. */
  async validate(payload: JwtPayload): Promise<SafeUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('A refresh token cannot be used to access this resource');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('The user attached to this token no longer exists');
    }

    return user;
  }
}

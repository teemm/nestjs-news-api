import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates the `Authorization: Bearer <accessToken>` header. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

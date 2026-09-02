import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SafeUser } from '../../auth/types/auth.types';

/**
 * Injects the authenticated user (or one of its properties) into a handler.
 *
 * @example
 * findMe(@CurrentUser() user: SafeUser) {}
 * findMyId(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (property: keyof SafeUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: SafeUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('No authenticated user found on the request');
    }

    return property ? user[property] : user;
  },
);

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/auth.types';

/** Field selection that guarantees the password hash never leaves the service. */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the full user record including the password hash.
   * Only for internal credential checks — never expose the result directly.
   */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findByEmail(email: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: SAFE_USER_SELECT,
    });
  }

  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  async findByIdOrFail(id: string): Promise<SafeUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id "${id}" was not found`);
    }

    return user;
  }

  /**
   * Persists a new user. `password` must already be hashed.
   * A duplicate email surfaces as Prisma P2002 -> 409 via the global filter.
   */
  create(input: CreateUserInput): Promise<SafeUser> {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        password: input.password,
        name: input.name,
        role: input.role ?? Role.USER,
      },
      select: SAFE_USER_SELECT,
    });
  }
}

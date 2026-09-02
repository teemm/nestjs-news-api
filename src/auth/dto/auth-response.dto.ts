import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserDto {
  @ApiProperty({ example: '66f1c2a5b3d4e5f6a7b8c9d0' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @ApiProperty({ example: '2026-09-02T10:15:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-02T10:15:00.000Z' })
  updatedAt: Date;
}

export class TokensDto {
  @ApiProperty({ description: 'Short-lived access token (JWT_ACCESS_EXPIRES, default 15m)' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived refresh token (JWT_REFRESH_EXPIRES, default 7d)' })
  refreshToken: string;
}

export class AuthResponseDto extends TokensDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'The refreshToken returned by /auth/login or /auth/register',
  })
  @IsJWT({ message: 'refreshToken must be a valid JWT' })
  refreshToken: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimLowercase } from '../../common/utils/transform.util';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Transform(trimLowercase)
  email: string;

  @ApiProperty({ example: 'Str0ngPassword' })
  @IsString()
  @MinLength(1, { message: 'password should not be empty' })
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trim, trimLowercase } from '../../common/utils/transform.util';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com', description: 'Unique email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Transform(trimLowercase)
  email: string;

  @ApiProperty({
    example: 'Str0ngPassword',
    minLength: 8,
    description: 'At least 8 characters, one uppercase letter and one digit',
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72, { message: 'password must not exceed 72 characters' })
  @Matches(/[A-Z]/, { message: 'password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'password must contain at least one digit' })
  password: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 80 })
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

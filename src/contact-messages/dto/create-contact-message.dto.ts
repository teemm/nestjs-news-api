import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../common/utils/transform.util';

export class CreateContactMessageDto {
  @IsString() @Transform(trim) @IsNotEmpty() @MaxLength(100)
  name: string;

  @IsEmail() @Transform(trim) @MaxLength(254)
  email: string;

  @IsString() @Transform(trim) @IsNotEmpty() @MaxLength(160)
  subject: string;

  @IsString() @Transform(trim) @MinLength(10) @MaxLength(5000)
  message: string;
}

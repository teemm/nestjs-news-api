import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { toOptionalBoolean, toStringArray, trim } from '../../common/utils/transform.util';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ example: 'NestJS 11 ships with faster bootstrapping', maxLength: 200 })
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'A short summary shown in listings.', maxLength: 500 })
  @IsString()
  @Transform(trim)
  @MinLength(10)
  @MaxLength(500)
  excerpt: string;

  @ApiProperty({ example: 'The full article body, markdown or HTML.' })
  @IsString()
  @MinLength(20)
  content: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['nestjs', 'prisma'],
    description: 'Array of tags, or a comma-separated string ("nestjs,prisma")',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  published?: boolean;
}

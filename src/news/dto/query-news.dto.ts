import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { toOptionalBoolean, trim } from '../../common/utils/transform.util';

export class QueryNewsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Case-insensitive match against title, excerpt and content',
    example: 'prisma',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Return only items carrying this tag', example: 'nestjs' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(40)
  tag?: string;

  @ApiPropertyOptional({
    description: 'Filter by publication state. Defaults to true (public listing).',
    example: true,
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  published?: boolean;
}

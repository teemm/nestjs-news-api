import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { toOptionalBoolean, trim } from '../../common/utils/transform.util';

export class CreateVideoDto {
  @ApiProperty({ example: 'Designing for every screen' })
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ example: 'https://www.youtube.com/watch?v=example' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_valid_protocol: true })
  url?: string;

  @ApiPropertyOptional({ example: 'https://img.youtube.com/vi/example/hqdefault.jpg' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'], require_valid_protocol: true })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

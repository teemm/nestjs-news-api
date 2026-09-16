import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { toOptionalBoolean, trim } from '../../common/utils/transform.util';

export class CreateBannerDto {
  @ApiProperty({ example: 'Summer sale' })
  @IsString()
  @Transform(trim)
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ example: 'https://example.com/summer-sale' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  link?: string;

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
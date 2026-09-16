import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUrl } from 'class-validator';
import { CreateBannerDto } from './create-banner.dto';

export class UpdateBannerDto extends PartialType(OmitType(CreateBannerDto, ['link'] as const)) {
  @ApiPropertyOptional({ nullable: true, description: 'Send an empty string or null to remove the link.' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  link?: string | null;
}

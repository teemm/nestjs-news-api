import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BannerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: 'http://localhost:3000/uploads/banners/banner.jpg' })
  image: string;

  @ApiPropertyOptional({ nullable: true })
  link: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
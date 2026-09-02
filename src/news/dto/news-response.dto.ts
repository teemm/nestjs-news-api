import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class NewsAuthorDto {
  @ApiProperty({ example: '66f1c2a5b3d4e5f6a7b8c9d0' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ enum: Role })
  role: Role;
}

export class NewsDto {
  @ApiProperty({ example: '66f1c2a5b3d4e5f6a7b8c9d1' })
  id: string;

  @ApiProperty({ example: 'NestJS 11 ships with faster bootstrapping' })
  title: string;

  @ApiProperty({ example: 'nestjs-11-ships-with-faster-bootstrapping' })
  slug: string;

  @ApiProperty()
  excerpt: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'http://localhost:3000/uploads/news/6f1a1f2e-...jpg',
  })
  coverImage: string | null;

  @ApiProperty({ type: [String], example: ['nestjs', 'prisma'] })
  tags: string[];

  @ApiProperty({ example: true })
  published: boolean;

  @ApiProperty({ example: 42 })
  views: number;

  @ApiProperty({ example: '66f1c2a5b3d4e5f6a7b8c9d0' })
  authorId: string;

  @ApiProperty({ type: NewsAuthorDto })
  author: NewsAuthorDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 57 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 6 })
  totalPages: number;
}

export class PaginatedNewsDto {
  @ApiProperty({ type: [NewsDto] })
  data: NewsDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

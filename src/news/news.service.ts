import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { News, Prisma, Role } from '@prisma/client';
import { buildImageUrl, removeImageByUrl } from '../common/config/multer.config';
import { slugify } from '../common/utils/slug.util';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/auth.types';
import { CreateNewsDto } from './dto/create-news.dto';
import { QueryNewsDto } from './dto/query-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

const NEWS_INCLUDE = {
  author: { select: { id: true, email: true, name: true, role: true } },
} satisfies Prisma.NewsInclude;

export type NewsWithAuthor = Prisma.NewsGetPayload<{ include: typeof NEWS_INCLUDE }>;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedNews {
  data: NewsWithAuthor[];
  meta: PaginationMeta;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  async findAll(query: QueryNewsDto): Promise<PaginatedNews> {
    const { page, limit, search, tag } = query;
    // Anonymous listings default to published content only.
    const published = query.published ?? true;

    const where: Prisma.NewsWhereInput = {
      published,
      ...(tag ? { tags: { has: tag } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { excerpt: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { content: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.news.count({ where }),
      this.prisma.news.findMany({
        where,
        include: NEWS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Public read: returns the article and counts the view in one round trip. */
  async findBySlug(slug: string): Promise<NewsWithAuthor> {
    try {
      return await this.prisma.news.update({
        where: { slug },
        data: { views: { increment: 1 } },
        include: NEWS_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No news item found for slug "${slug}"`);
      }
      throw error;
    }
  }

  async create(
    authorId: string,
    dto: CreateNewsDto,
    image?: Express.Multer.File,
  ): Promise<NewsWithAuthor> {
    const slug = await this.generateUniqueSlug(dto.title);

    const created = await this.prisma.news.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        tags: dto.tags ?? [],
        published: dto.published ?? false,
        coverImage: image ? buildImageUrl(this.appUrl, image.filename) : null,
        author: { connect: { id: authorId } },
      },
      include: NEWS_INCLUDE,
    });

    this.logger.log(`Created news "${created.slug}" by ${authorId}`);

    return created;
  }

  async update(
    id: string,
    user: SafeUser,
    dto: UpdateNewsDto,
    image?: Express.Multer.File,
  ): Promise<NewsWithAuthor> {
    const existing = await this.findByIdOrFail(id);
    this.assertCanManage(existing, user);

    const data: Prisma.NewsUpdateInput = {};

    if (dto.title !== undefined && dto.title !== existing.title) {
      data.title = dto.title;
      data.slug = await this.generateUniqueSlug(dto.title, id);
    }
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.published !== undefined) data.published = dto.published;
    if (image) data.coverImage = buildImageUrl(this.appUrl, image.filename);

    const updated = await this.prisma.news.update({
      where: { id },
      data,
      include: NEWS_INCLUDE,
    });

    // Only drop the previous file once the write succeeded.
    if (image && existing.coverImage) {
      removeImageByUrl(existing.coverImage);
    }

    return updated;
  }

  async remove(id: string, user: SafeUser): Promise<{ id: string; deleted: true }> {
    const existing = await this.findByIdOrFail(id);
    this.assertCanManage(existing, user);

    await this.prisma.news.delete({ where: { id } });
    removeImageByUrl(existing.coverImage);

    this.logger.log(`Deleted news "${existing.slug}" by ${user.id}`);

    return { id, deleted: true };
  }

  private async findByIdOrFail(id: string): Promise<News> {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new NotFoundException(`No news item found with id "${id}"`);
    }

    const news = await this.prisma.news.findUnique({ where: { id } });

    if (!news) {
      throw new NotFoundException(`No news item found with id "${id}"`);
    }

    return news;
  }

  private assertCanManage(news: News, user: SafeUser): void {
    if (news.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only the author or an administrator can modify this news item');
    }
  }

  /**
   * Derives a slug from the title and appends `-2`, `-3`, ... until it is free.
   * `excludeId` keeps an item's own slug available while it is being updated.
   */
  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);

    for (let suffix = 1; suffix < 1000; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      const clash = await this.prisma.news.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!clash || clash.id === excludeId) {
        return candidate;
      }
    }

    // Practically unreachable; guarantees termination with a unique value.
    return `${base}-${Date.now()}`;
  }
}

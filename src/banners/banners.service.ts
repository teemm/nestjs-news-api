import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  BANNER_PUBLIC_PATH,
  buildImageUrl,
  removeImageByUrl,
} from '../common/config/multer.config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  private readonly appUrl: string;
  private lastRandomBannerId?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  findAll(includeInactive = false): Promise<Banner[]> {
    return this.prisma.banner.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findRandom(): Promise<Banner> {
    const banners = await this.prisma.banner.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (banners.length === 0) {
      throw new NotFoundException('No active banners are available');
    }

    const choices = banners.filter((banner) => banner.id !== this.lastRandomBannerId);
    const selected = choices[Math.floor(Math.random() * choices.length)] ?? banners[0];
    this.lastRandomBannerId = selected.id;
    return selected;
  }

  create(dto: CreateBannerDto, image: Express.Multer.File): Promise<Banner> {
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        image: buildImageUrl(this.appUrl, image.filename, BANNER_PUBLIC_PATH),
        link: dto.link,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto, image?: Express.Multer.File): Promise<Banner> {
    const existing = await this.findByIdOrFail(id);
    const data: Prisma.BannerUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.link !== undefined ? { link: dto.link } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(image
        ? { image: buildImageUrl(this.appUrl, image.filename, BANNER_PUBLIC_PATH) }
        : {}),
    };

    const updated = await this.prisma.banner.update({ where: { id }, data });
    if (image) removeImageByUrl(existing.image);
    return updated;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.findByIdOrFail(id);
    await this.prisma.banner.delete({ where: { id } });
    removeImageByUrl(existing.image);
    return { id, deleted: true };
  }

  private async findByIdOrFail(id: string): Promise<Banner> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`No banner found with id "${id}"`);
    return banner;
  }
}
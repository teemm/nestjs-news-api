import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Video } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  buildImageUrl, MAX_IMAGE_SIZE_BYTES, removeVideoByUrl, removeVideoThumbnailByUrl,
  VIDEO_PUBLIC_PATH, VIDEO_THUMBNAIL_PUBLIC_PATH,
} from '../common/config/multer.config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
  private readonly appUrl: string;
  constructor(private readonly prisma: PrismaService, config: ConfigService<EnvironmentVariables, true>) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  findAll(includeInactive = false): Promise<Video[]> {
    return this.prisma.video.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateVideoDto, videoFile?: Express.Multer.File, thumbnailFile?: Express.Multer.File): Promise<Video> {
    this.validateThumbnail(thumbnailFile);
    const url = videoFile ? buildImageUrl(this.appUrl, videoFile.filename, VIDEO_PUBLIC_PATH) : dto.url;
    const thumbnailUrl = thumbnailFile
      ? buildImageUrl(this.appUrl, thumbnailFile.filename, VIDEO_THUMBNAIL_PUBLIC_PATH)
      : dto.thumbnailUrl ?? '';
    this.validateSource(url, thumbnailUrl);
    const id = randomBytes(12).toString('hex');
    const createdAt = new Date();
    const video: Video = {
      id, title: dto.title, url: url!, thumbnailUrl, active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 0, createdAt, updatedAt: createdAt,
    };
    await this.prisma.$runCommandRaw({
      insert: 'videos',
      documents: [{
        _id: { $oid: id }, title: video.title, url: video.url, thumbnailUrl,
        active: video.active, sortOrder: video.sortOrder,
        createdAt: { $date: createdAt.toISOString() }, updatedAt: { $date: createdAt.toISOString() },
      }],
    });
    return video;
  }

  async update(id: string, dto: UpdateVideoDto, videoFile?: Express.Multer.File, thumbnailFile?: Express.Multer.File): Promise<Video> {
    this.validateThumbnail(thumbnailFile);
    const existing = await this.findByIdOrFail(id);
    const url = videoFile ? buildImageUrl(this.appUrl, videoFile.filename, VIDEO_PUBLIC_PATH) : dto.url ?? existing.url;
    const thumbnailUrl = thumbnailFile
      ? buildImageUrl(this.appUrl, thumbnailFile.filename, VIDEO_THUMBNAIL_PUBLIC_PATH)
      : dto.thumbnailUrl ?? existing.thumbnailUrl;
    this.validateSource(url, thumbnailUrl);
    const data: Record<string, string | boolean | number | { $date: string }> = {
      ...(dto.title !== undefined ? { title: dto.title } : {}), url, thumbnailUrl,
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      updatedAt: { $date: new Date().toISOString() },
    };
    await this.prisma.$runCommandRaw({
      update: 'videos', updates: [{ q: { _id: { $oid: id } }, u: { $set: data } }],
    });
    if (existing.url !== url) removeVideoByUrl(existing.url);
    if (existing.thumbnailUrl !== thumbnailUrl) removeVideoThumbnailByUrl(existing.thumbnailUrl);
    return this.findByIdOrFail(id);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.findByIdOrFail(id);
    await this.prisma.$runCommandRaw({
      delete: 'videos', deletes: [{ q: { _id: { $oid: id } }, limit: 1 }],
    });
    removeVideoByUrl(existing.url);
    removeVideoThumbnailByUrl(existing.thumbnailUrl);
    return { id, deleted: true };
  }

  private validateThumbnail(file?: Express.Multer.File): void {
    if (file && file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Preview image is too large. The maximum size is 5 MB.');
    }
  }
  private validateSource(url: string | undefined, thumbnailUrl: string): void {
    if (!url) throw new BadRequestException('Upload a video or enter a video link.');
    if (!/\.(mp4|webm|ogv|ogg)$/i.test(new URL(url).pathname) && !thumbnailUrl) {
      throw new BadRequestException('Video links need a preview image.');
    }
  }
  private async findByIdOrFail(id: string): Promise<Video> {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }
}

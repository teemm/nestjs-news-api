import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { videoAssetMulterOptions } from '../common/config/multer.config';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideosService } from './videos.service';

type VideoAssets = { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] };

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return this.videosService.findAll(all === 'true');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 },
  ], videoAssetMulterOptions))
  create(@Body() dto: CreateVideoDto, @UploadedFiles() files: VideoAssets = {}) {
    return this.videosService.create(dto, files.video?.[0], files.thumbnail?.[0]);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 },
  ], videoAssetMulterOptions))
  update(@Param('id') id: string, @Body() dto: UpdateVideoDto, @UploadedFiles() files: VideoAssets = {}) {
    return this.videosService.update(id, dto, files.video?.[0], files.thumbnail?.[0]);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { bannerImageMulterOptions } from '../common/config/multer.config';
import { BannerDto } from './dto/banner-response.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannersService } from './banners.service';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'List active banners' })
  @ApiOkResponse({ type: BannerDto, isArray: true })
  findAll(@Query('all') all?: string) {
    return this.bannersService.findAll(all === 'true');
  }

  @Get('random')
  @ApiOperation({ summary: 'Return a random active banner without immediate repetition' })
  @ApiOkResponse({ type: BannerDto })
  random() {
    return this.bannersService.findRandom();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image', bannerImageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['title', 'image'], properties: {
    title: { type: 'string', example: 'Summer sale' },
    link: { type: 'string', example: 'https://example.com' },
    active: { type: 'boolean', example: true },
    sortOrder: { type: 'integer', example: 0 },
    image: { type: 'string', format: 'binary' },
  } } })
  @ApiCreatedResponse({ type: BannerDto })
  create(@Body() dto: CreateBannerDto, @UploadedFile() image?: Express.Multer.File) {
    if (!image) throw new BadRequestException('Banner image is required');
    return this.bannersService.create(dto, image);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image', bannerImageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateBannerDto })
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto, @UploadedFile() image?: Express.Multer.File) {
    return this.bannersService.update(id, dto, image);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
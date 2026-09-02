import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SafeUser } from '../auth/types/auth.types';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  newsImageMulterOptions,
} from '../common/config/multer.config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateNewsDto } from './dto/create-news.dto';
import { NewsDto, PaginatedNewsDto } from './dto/news-response.dto';
import { QueryNewsDto } from './dto/query-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsService, NewsWithAuthor, PaginatedNews } from './news.service';

const IMAGE_DESCRIPTION = `Cover image. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}. Max ${
  MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
} MB.`;

/** Shared multipart body definition for POST and PATCH. */
const multipartSchema = (required: string[]) => ({
  type: 'object',
  required,
  properties: {
    title: { type: 'string', example: 'NestJS 11 ships with faster bootstrapping' },
    excerpt: { type: 'string', example: 'A short summary shown in listings.' },
    content: { type: 'string', example: 'The full article body, markdown or HTML.' },
    tags: { type: 'string', example: 'nestjs,prisma', description: 'Comma-separated list' },
    published: { type: 'boolean', example: false },
    image: { type: 'string', format: 'binary', description: IMAGE_DESCRIPTION },
  },
});

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'List news items (public, paginated)' })
  @ApiOkResponse({ type: PaginatedNewsDto })
  findAll(@Query() query: QueryNewsDto): Promise<PaginatedNews> {
    return this.newsService.findAll(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Fetch one news item by slug and increment its view counter' })
  @ApiParam({ name: 'slug', example: 'nestjs-11-ships-with-faster-bootstrapping' })
  @ApiOkResponse({ type: NewsDto })
  @ApiNotFoundResponse({ description: 'No news item matches the slug' })
  findOne(@Param('slug') slug: string): Promise<NewsWithAuthor> {
    return this.newsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image', newsImageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: multipartSchema(['title', 'excerpt', 'content']) })
  @ApiOperation({ summary: 'Create a news item with an optional cover image' })
  @ApiCreatedResponse({ type: NewsDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, or the image is too large / not an allowed type',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  create(
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateNewsDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<NewsWithAuthor> {
    return this.newsService.create(authorId, dto, image);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image', newsImageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: multipartSchema([]) })
  @ApiOperation({
    summary: 'Update a news item (author or ADMIN); a new image replaces the old file',
  })
  @ApiParam({ name: 'id', example: '66f1c2a5b3d4e5f6a7b8c9d1' })
  @ApiOkResponse({ type: NewsDto })
  @ApiForbiddenResponse({ description: 'Only the author or an administrator may edit' })
  @ApiNotFoundResponse({ description: 'No news item matches the id' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: SafeUser,
    @Body() dto: UpdateNewsDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<NewsWithAuthor> {
    return this.newsService.update(id, user, dto, image);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a news item and its cover image (author or ADMIN)' })
  @ApiParam({ name: 'id', example: '66f1c2a5b3d4e5f6a7b8c9d1' })
  @ApiOkResponse({ schema: { example: { id: '66f1c2a5b3d4e5f6a7b8c9d1', deleted: true } } })
  @ApiForbiddenResponse({ description: 'Only the author or an administrator may delete' })
  @ApiNotFoundResponse({ description: 'No news item matches the id' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: SafeUser,
  ): Promise<{ id: string; deleted: true }> {
    return this.newsService.remove(id, user);
  }
}

import { PartialType } from '@nestjs/swagger';
import { CreateNewsDto } from './create-news.dto';

/** Every field optional; sending `image` replaces the current cover. */
export class UpdateNewsDto extends PartialType(CreateNewsDto) {}

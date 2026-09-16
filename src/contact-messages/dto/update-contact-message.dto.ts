import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { toOptionalBoolean } from '../../common/utils/transform.util';

export class UpdateContactMessageDto {
  @Transform(toOptionalBoolean)
  @IsBoolean()
  read: boolean;
}

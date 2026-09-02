import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, IsUrl, Matches, MinLength, validateSync } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Shape of the validated environment. Injected as
 * `ConfigService<EnvironmentVariables, true>` so `config.get('PORT')` is typed.
 */
export class EnvironmentVariables {
  @IsString()
  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'DATABASE_URL must be a mongodb:// or mongodb+srv:// connection string',
  })
  DATABASE_URL: string;

  @IsString()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET must be at least 16 characters long' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(16, { message: 'JWT_REFRESH_SECRET must be at least 16 characters long' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @Matches(/^\d+(ms|s|m|h|d|w|y)?$/, {
    message: 'JWT_ACCESS_EXPIRES must be a duration such as "15m", "3600s" or "900"',
  })
  JWT_ACCESS_EXPIRES: string;

  @IsString()
  @Matches(/^\d+(ms|s|m|h|d|w|y)?$/, {
    message: 'JWT_REFRESH_EXPIRES must be a duration such as "7d", "168h" or "604800"',
  })
  JWT_REFRESH_EXPIRES: string;

  @Type(() => Number)
  @IsInt()
  PORT: number;

  @IsUrl({ require_tld: false, require_protocol: true }, { message: 'APP_URL must be a valid URL' })
  APP_URL: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return validated;
}

import { TransformFnParams } from 'class-transformer';

/** Trims surrounding whitespace, leaving non-string values untouched. */
export function trim({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

/** Trims and lowercases — used for email fields so lookups stay case-insensitive. */
export function trimLowercase({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown);
}

/**
 * Accepts `true|false|1|0|yes|no` from multipart fields and query strings.
 * Unrecognised input is passed through so @IsBoolean() reports it.
 */
export function toOptionalBoolean({ value }: TransformFnParams): unknown {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return value as unknown;
}

/** Accepts a real array or a comma-separated string ("nestjs,prisma"). */
export function toStringArray({ value }: TransformFnParams): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return value as unknown;
}

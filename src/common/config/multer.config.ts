import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { diskStorage } from 'multer';

/** Absolute directory news cover images are written to. */
export const NEWS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'news');

/** Public path prefix the uploads directory is served under (see ServeStaticModule). */
export const NEWS_PUBLIC_PATH = '/uploads/news';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function ensureUploadDir(): void {
  if (!existsSync(NEWS_UPLOAD_DIR)) {
    mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });
  }
}

ensureUploadDir();

/**
 * Multer options for the news `image` field:
 * disk storage under ./uploads/news, uuid filenames, mime whitelist, 5 MB cap.
 */
export const newsImageMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      ensureUploadDir();
      callback(null, NEWS_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      const originalExtension = extname(file.originalname).toLowerCase();
      const extension =
        /^\.[a-z0-9]{2,5}$/.test(originalExtension) && originalExtension !== '.jpeg'
          ? originalExtension
          : (EXTENSION_BY_MIME[file.mimetype] ?? '.bin');
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])
    ) {
      callback(
        new BadRequestException(
          `Unsupported file type "${file.mimetype}". Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}.`,
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

/** Builds the absolute public URL for a stored file. */
export function buildImageUrl(appUrl: string, filename: string): string {
  return `${appUrl.replace(/\/+$/, '')}${NEWS_PUBLIC_PATH}/${filename}`;
}

/**
 * Deletes a stored cover image given the public URL previously produced by
 * `buildImageUrl`. Only touches files inside NEWS_UPLOAD_DIR and never throws.
 */
export function removeImageByUrl(imageUrl: string | null | undefined): void {
  if (!imageUrl) {
    return;
  }

  const filename = basename(imageUrl.split('?')[0]);
  if (!filename || filename === '.' || filename === '..') {
    return;
  }

  const filePath = join(NEWS_UPLOAD_DIR, filename);
  if (!filePath.startsWith(NEWS_UPLOAD_DIR)) {
    return;
  }

  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Deleting a stale file must never break the request.
  }
}

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { diskStorage } from 'multer';

export const NEWS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'news');
export const BANNER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'banners');
export const VIDEO_UPLOAD_DIR = join(process.cwd(), 'uploads', 'videos');
export const VIDEO_THUMBNAIL_UPLOAD_DIR = join(process.cwd(), 'uploads', 'video-thumbnails');

export const NEWS_PUBLIC_PATH = '/uploads/news';
export const BANNER_PUBLIC_PATH = '/uploads/banners';
export const VIDEO_PUBLIC_PATH = '/uploads/videos';
export const VIDEO_THUMBNAIL_PUBLIC_PATH = '/uploads/video-thumbnails';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
};
const VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
};

function ensureUploadDir(directory: string): void {
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
}
[NEWS_UPLOAD_DIR, BANNER_UPLOAD_DIR, VIDEO_UPLOAD_DIR, VIDEO_THUMBNAIL_UPLOAD_DIR].forEach(ensureUploadDir);

function imageMulterOptions(directory: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, callback) => { ensureUploadDir(directory); callback(null, directory); },
      filename: (_req, file, callback) => {
        const originalExtension = extname(file.originalname).toLowerCase();
        const extension = /^\.[a-z0-9]{2,5}$/.test(originalExtension) && originalExtension !== '.jpeg'
          ? originalExtension : (IMAGE_EXTENSION_BY_MIME[file.mimetype] ?? '.bin');
        callback(null, randomUUID() + extension);
      },
    }),
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!IMAGE_EXTENSION_BY_MIME[file.mimetype]) {
        callback(new BadRequestException('Unsupported image type. Upload a JPG, PNG, or WebP image.'), false);
        return;
      }
      callback(null, true);
    },
  };
}
export const newsImageMulterOptions = imageMulterOptions(NEWS_UPLOAD_DIR);
export const bannerImageMulterOptions = imageMulterOptions(BANNER_UPLOAD_DIR);

export const videoAssetMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, file, callback) => {
      const directory = file.fieldname === 'thumbnail' ? VIDEO_THUMBNAIL_UPLOAD_DIR : VIDEO_UPLOAD_DIR;
      ensureUploadDir(directory);
      callback(null, directory);
    },
    filename: (_req, file, callback) => {
      const extensions = file.fieldname === 'thumbnail' ? IMAGE_EXTENSION_BY_MIME : VIDEO_EXTENSION_BY_MIME;
      callback(null, randomUUID() + extensions[file.mimetype]);
    },
  }),
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES, files: 2 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.fieldname === 'video'
      ? Boolean(VIDEO_EXTENSION_BY_MIME[file.mimetype])
      : file.fieldname === 'thumbnail' && Boolean(IMAGE_EXTENSION_BY_MIME[file.mimetype]);
    if (!allowed) {
      callback(new BadRequestException(file.fieldname === 'thumbnail'
        ? 'Unsupported preview image type. Upload a JPG, PNG, or WebP image.'
        : 'Unsupported video type. Upload an MP4, WebM, or Ogg video.'), false);
      return;
    }
    callback(null, true);
  },
};

export function buildImageUrl(appUrl: string, filename: string, publicPath = NEWS_PUBLIC_PATH): string {
  return appUrl.replace(/\/+$/, '') + publicPath + '/' + filename;
}

function removeGeneratedFile(url: string | null | undefined, publicPath: string, directory: string, extensions: string): void {
  if (!url) return;
  const pathname = new URL(url, 'http://localhost').pathname;
  if (!pathname.startsWith(publicPath + '/')) return;
  const filename = basename(pathname);
  if (!new RegExp('^[a-f0-9-]+\\.(' + extensions + ')$').test(filename)) return;
  try { if (existsSync(join(directory, filename))) unlinkSync(join(directory, filename)); } catch { }
}
export function removeImageByUrl(url: string | null | undefined): void {
  if (url?.includes(BANNER_PUBLIC_PATH)) removeGeneratedFile(url, BANNER_PUBLIC_PATH, BANNER_UPLOAD_DIR, 'jpg|png|webp');
  else removeGeneratedFile(url, NEWS_PUBLIC_PATH, NEWS_UPLOAD_DIR, 'jpg|png|webp');
}
export function removeVideoByUrl(url: string | undefined): void {
  removeGeneratedFile(url, VIDEO_PUBLIC_PATH, VIDEO_UPLOAD_DIR, 'mp4|webm|ogv');
}
export function removeVideoThumbnailByUrl(url: string | undefined): void {
  removeGeneratedFile(url, VIDEO_THUMBNAIL_PUBLIC_PATH, VIDEO_THUMBNAIL_UPLOAD_DIR, 'jpg|png|webp');
}
export function removeUploadedFile(file: Express.Multer.File): void {
  const url = '/' + file.path.replaceAll('\\', '/').split('/uploads/').at(-1);
  if (file.destination === VIDEO_UPLOAD_DIR) removeVideoByUrl('/uploads' + url);
  else if (file.destination === VIDEO_THUMBNAIL_UPLOAD_DIR) removeVideoThumbnailByUrl('/uploads' + url);
  else removeImageByUrl('/uploads' + url);
}
